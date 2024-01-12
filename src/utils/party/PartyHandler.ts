import crypto from "node:crypto";
import { Saves } from "../../xmpp/types/Saves";
import { DateTime } from "luxon";
import { Globals } from "../../xmpp/types/XmppTypes";
import xmlbuilder from "xmlbuilder";
import log from "../log";

interface Connection {
  id: string;
  meta: { [key: string]: any };
}

interface JoinInfo {
  meta: { [key: string]: any };
}

export default class PartyHandler {
  private static id: string = "";

  constructor(JoinInfoConnection: Connection, JoinInfo: JoinInfo) {
    PartyHandler.id = crypto.randomBytes(16).toString("hex");

    Saves.members.push([
      {
        account_id: JoinInfoConnection.id.split("@")[0],
        meta: {
          "urn:epic:member:dn_s": JoinInfo.meta["urn:epic:member:dn_s"],
        },
        connections: [
          {
            id: JoinInfoConnection.id,
            connected_at: DateTime.now().toISO(),
            updated_at: DateTime.now().toISO(),
            yield_leadership: false,
            meta: JoinInfoConnection.meta,
          },
        ],
        revision: 0,
        updated_at: DateTime.now().toISO(),
        joined_at: DateTime.now().toISO(),
        role: "CAPTAIN",
      },
    ]);

    Saves.parties.push({
      id: PartyHandler.id,
      privacy: "PUBLIC",
      members: Saves.members.map((member) => member.account_id),
      party: PartyHandler,
    });

    this.notify(JoinInfoConnection, JoinInfo);
  }

  private notify(JoinInfoConnection: Connection, JoinInfo: JoinInfo) {
    log.debug(`Test: ${JoinInfoConnection.id.split("@")[0]}`, "PartyHandler");
    const accountId = JoinInfoConnection.id.split("@")[0];
    const clientIndex = Globals.Clients.findIndex(
      (client) => client.accountId === accountId
    );

    const member = Saves.members.find((m) => m.account_id === accountId);

    const client = Globals.Clients[clientIndex];

    if (!client) {
      log.error(
        `Failed to find client with the accountId: ${accountId}`,
        "PartyHandler"
      );
      return;
    }

    if (!client.socket) {
      log.error("Socket not found.", "PartyHandler");
      return;
    }

    if (client && clientIndex !== -1) {
      // client.socket.send("xmpp-admin@prod.ol.epicgames");
      PartyHandler.sendXmppMessageToClient(
        xmlbuilder
          .create("message")
          .attribute("xmlns", "jabber:client")
          .attribute("to", client.jid)
          .attribute("from", "xmpp-admin@prod.ol.epicgames.com")
          .attribute("id", Globals.UUID.replace(/-/g, ""))
          .element(
            "body",
            JSON.stringify({
              account_dn: JoinInfo.meta["urn:epic:member:dn_s"],
              account_id: accountId,
              connection: {
                connected_at: DateTime.now().toISO(),
                id: JoinInfoConnection.id.split("@"),
                meta: JoinInfoConnection.meta,
                updated_at: DateTime.now().toISO(),
                joined_at: DateTime.now().toISO(),
              },
              member_state_update: {
                "urn:epic:member:dn_s": JoinInfo.meta["urn:epic:member:dn_s"],
              },
              ns: "Fortnite",
              party_id: PartyHandler.id,
              revision: member.revision,
              sent: DateTime.now().toISO(),
              type: "com.epicgames.social.party.notification.v0.MEMBER_JOINED",
              updated_at: DateTime.now().toISO(),
            })
          )
          .toString({ pretty: true })
      );
    }
  }

  static createParty() {
    const party = {
      id: this.id,
      privacy: "OPEN",
      members: Saves.members.map((member) => member.account_id),
      party: PartyHandler,
    };

    Saves.parties.push(party);

    return party;
  }

  static updateParty(partyId: string) {
    const partyIndex = Saves.parties.findIndex((party) => party.id === partyId);

    if (partyIndex !== -1) {
      const updatedParty = {
        id: partyId,
        members: Saves.members.map((member) => member.account_id),
        party: Saves.parties[partyIndex],
      };

      Saves.parties.splice(partyIndex, 1, updatedParty);
    } else {
      log.error(`Party with the id ${partyId} was not found.`, "PartyHandler");
      return;
    }
  }

  static addMemberToParty(connection: Connection) {
    const account_id = connection.id.split("@")[0];
    const meta = {
      "urn:epic:member:dn_s": connection.meta["urn:epic:member:dn_s"],
    };

    const newMember = {
      account_id,
      meta,
      connections: [
        {
          id: connection.id,
          connected_at: DateTime.now().toISO(),
          updated_at: DateTime.now().toISO(),
          yield_leadership: false,
          meta: connection.meta,
        },
      ],
      revision: 0,
      joined_at: DateTime.now().toISO(),
      updated_at: DateTime.now().toISO(),
      role: "CAPTAIN",
    };

    Saves.members.push([newMember]);

    return newMember;
  }

  static sendXmppMessageToClient(data: string) {
    Saves.members.forEach((member) => {
      const client = Globals.Clients[member.account_id];
      const socket = client.socket;

      if (socket) {
        socket.send(data);
      }
    });
  }
}