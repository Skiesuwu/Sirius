import WebSocket from "ws";
import xmlbuilder from "xmlbuilder";
import xmlparser from "xml-parser";
import log from "../../utils/log";
import { Globals, MUCs } from "../types/XmppTypes";
import { Saves } from "../types/Saves";
import updatePresenceForClientFriend from "../functions/updatePresenceForClientFriend";

export default async function presence(
  socket: WebSocket,
  document: xmlparser.Node,
  id: string
): Promise<void> {
  const rootType = document.attributes.type;
  const to = document.attributes.to;
  const children = document.children;

  // if (!Saves.clientExists) {
  //   socket.send(
  //     xmlbuilder
  //       .create("close")
  //       .attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-framing")
  //       .toString({ pretty: true })
  //   );
  //   socket.close();
  //   return;
  // }

  switch (rootType) {
    case "unavailable":
      if (
        to.endsWith("@muc.prod.ol.epicgames.com") ||
        to.split("/")[0].endsWith("@muc.prod.ol.epicgames.com")
      ) {
        const roomName = to.split("@")[0];
        const MUCs = Globals.MUCs;
        // @ts-ignore
        const room = MUCs[roomName];

        if (room) {
          const roomMemberIndex = room.members.findIndex(
            (member: { accountId: string }) =>
              member.accountId === (socket as any).accountId
          );

          if (roomMemberIndex !== undefined && roomMemberIndex !== -1) {
            room.members.splice(roomMemberIndex, 1);
            Saves.JoinedMUCs.splice(Saves.JoinedMUCs.indexOf(roomName), 1);
          }

          return socket.send(
            xmlbuilder
              .create("presence")
              .attribute("to", (socket as any).jid)
              .attribute(
                "from",
                `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                  (socket as any).displayName
                )}:${(socket as any).accountId}:${(socket as any).resource}`
              )
              .attribute("xmlns", "jabber:client")
              .attribute("type", "unavailable")
              .element("x")
              .attribute("xmlns", "http://jabber.org/protocol/muc#user")
              .element("item")
              .attribute(
                "nick",
                `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                  (socket as any).displayName
                )}:${(socket as any).accountId}:${
                  (socket as any).resource
                }`.replace(`${roomName}@muc.prod.ol.epicgames.com/`, "")
              )
              .attribute("jid", (socket as any).jid)
              .attribute("role", "none")
              .up()
              .element("status")
              .attribute("code", "110")
              .up()
              .element("status")
              .attribute("code", "100")
              .up()
              .element("status")
              .attribute("code", "170")
              .up()
              .up()
              .toString({ pretty: true })
          );
        }
      }

      break;

    default:
      if (
        children.find((child) => child.name === "muc:x") ||
        children.find((child) => child.name === "x")
      ) {
        const roomName = to.split("@")[0];

        if (!MUCs) {
          // @ts-ignore
          Globals.MUCs[roomName] = { members: [] };
        }

        if (MUCs === undefined || !MUCs) {
          // @ts-ignore
          Globals.MUCs[roomName].members = [];
        }

        if (
          MUCs.members.find(
            (member: { accountId: string }) =>
              member.accountId === (socket as any).accountId
          )
        )
          return;

        if (MUCs) {
          MUCs.members = MUCs.members || [];
        } else {
          log.error(`MUC with roomName ${roomName} does not exist.`, "XMPP");
        }

        MUCs.members.push({
          accountId: (socket as any).accountId,
        });
        Saves.JoinedMUCs.push(roomName);

        socket.send(
          xmlbuilder
            .create("presence")
            .attribute("to", (socket as any).jid)
            .attribute(
              "from",
              `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                (socket as any).displayName
              )}:${(socket as any).accountId}:${(socket as any).resource}`
            )
            .attribute("xmlns", "jabber:client")
            .attribute("type", "unavailable")
            .element("x")
            .attribute("xmlns", "http://jabber.org/protocol/muc#user")
            .element("item")
            .attribute(
              "nick",
              `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                (socket as any).displayName
              )}:${(socket as any).accountId}:${
                (socket as any).resource
              }`.replace(`${roomName}@muc.prod.ol.epicgames.com/`, "")
            )
            .attribute("jid", (socket as any).jid)
            .attribute("role", "participant")
            .attribute("affiliation", "none")
            .up()
            .element("status")
            .attribute("code", "110")
            .up()
            .element("status")
            .attribute("code", "100")
            .up()
            .element("status")
            .attribute("code", "170")
            .up()
            .element("status")
            .attribute("code", "201")
            .up()
            .up()
            .toString({ pretty: true })
        );

        MUCs.members.forEach(async (member: { accountId: string }) => {
          const client = (global as any).Clients.find(
            (client: any) => client.accountId === member.accountId
          );

          if (!client) return;

          socket.send(
            xmlbuilder
              .create("presence")
              .attribute(
                "from",
                `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                  client?.displayName as string
                )}:${client?.accountId}:${client?.resource}`
              )
              .attribute("to", (socket as any).jid)
              .attribute("xmlns", "jabber:client")
              .element("x")
              .attribute("xmlns", "http://jabber.org/protocol/muc#user")
              .element("item")
              .attribute(
                "nick",
                `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                  (socket as any).displayName
                )}:${(socket as any).accountId}:${
                  (socket as any).resource
                }`.replace(`${roomName}@muc.prod.ol.epicgames.com/`, "")
              )
              .attribute("jid", client?.jid)
              .attribute("role", "participant")
              .attribute("affiliation", "none")
              .up()
              .up()
              .toString({ pretty: true })
          );

          if ((socket as any).accountId === client.accountId) return;

          client?.socket?.send(
            xmlbuilder
              .create("presence")
              .attribute(
                "from",
                `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                  (socket as any).displayName
                )}:${(socket as any).accountId}:${(socket as any).resource}`
              )
              .attribute("to", client.jid)
              .attribute("xmlns", "jabber:client")
              .element("x")
              .attribute("xmlns", "http://jabber.org/protocol/muc#user")
              .element("item")
              .attribute(
                "nick",
                `${roomName}@muc.prod.ol.epicgames.com/${encodeURI(
                  (socket as any).displayName
                )}:${(socket as any).accountId}:${
                  (socket as any).resource
                }`.replace(`${roomName}@muc.prod.ol.epicgames.com/`, "")
              )
              .attribute("jid", (socket as any).jid)
              .attribute("role", "participant")
              .attribute("affiliation", "none")
              .up()
              .up()
              .toString({ pretty: true })
          );
        });

        return;
      }

      const statusElement = document.children.find(
        (child) => child.name === "status"
      );

      if (!statusElement || !statusElement.content) {
        socket.close();
        return;
      }

      await updatePresenceForClientFriend(
        socket,
        statusElement.content,
        document.children.find((child) => child.name === "show") ? true : false,
        false
      );

      const sender = (global as any).Clients.find(
        (client: any) => client.accountId === (socket as any).accountId
      );
      const receiver = (global as any).Clients.find(
        (client: any) => client.accountId === (socket as any).accountId
      );

      if (!sender || !receiver) return;

      let xaml = xmlbuilder
        .create("message")
        .attribute("jid", (socket as any).jid)
        .attribute("xmlns", "jabber:client")
        .attribute("from", (socket as any).jid)
        .attribute("type", "available");

      if (sender.lastPresenceUpdate.away) {
        xaml = xaml
          .element("show", "away")
          .up()
          .element("status", sender.lastPresenceUpdate.status)
          .up();
      }

      xaml = xaml.element("status", sender.lastPresenceUpdate.status).up();

      socket.send(xaml.toString({ pretty: true }));

      break;
  }
}
