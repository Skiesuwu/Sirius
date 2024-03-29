import { Request, Response } from "express";
import { getCommonCore, getProfile } from "../../utils/getProfile";
import Accounts from "../../../../models/Accounts";
import { json } from "../../../../api/storefront";
import path from "node:path";
import log from "../../../../utils/log";
import { DateTime } from "luxon";
import { v4 as uuid } from "uuid";
import { GiftGlobals } from "../../../../types/GiftTypes";
import { Globals } from "../../../../xmpp/types/XmppTypes";
import xmlbuilder from "xmlbuilder";
import AddGift from "../../../../utils/AddGift";
import { sendErrorResponse } from "../../../../utils";
import fs from "node:fs/promises";

export default async function GiftCatalogEntry(
  req: Request,
  res: Response,
  accountId: string
) {
  try {
    const userProfiles = await getProfile(accountId);
    const common_core = await getCommonCore(accountId);
    const account = await Accounts.findOne({ accountId });

    if (!account) {
      return res.status(404).json({ error: "Account not Found." });
    }

    const { offerId, receiverAccountIds, personalMessage, giftWrapTemplateId } =
      req.body;

    const shopJsonPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "resources",
      "storefront",
      "shop.json"
    );

    const shopData = await json(shopJsonPath);

    if (personalMessage.length > 100) {
      return sendErrorResponse(
        res,
        "errors.com.epicgames.string.length_check",
        "Personal message is longer than 100 characters."
      );
    }

    let offerItem = null;
    let isOfferFound = false;
    const itemID = uuid();

    const cleanedOfferId = offerId.replace("v2:/", "");

    for (const section in shopData.catalogItems) {
      for (const item of shopData.catalogItems[section]) {
        if (item.id === cleanedOfferId) {
          isOfferFound = true;
          offerItem = item;
          break;
        }
      }

      if (isOfferFound) break;
    }

    if (!isOfferFound) {
      return res.status(400).json({
        errorCode: "errors.com.epicgames.fortnite.id_invalid",
        errorMessage: `Offer ID (${cleanedOfferId}) not found.`,
        messageVars: undefined,
        numericErrorCode: 1040,
        originatingService: "any",
        intent: "prod",
        error_description: `Offer ID (${cleanedOfferId}) not found.`,
        error: undefined,
      });
    }

    const price = offerItem.price * receiverAccountIds.length;

    const applyProfileChanges = [];

    for (const itemId in common_core.items) {
      const quantity = common_core.items[itemId].quantity;

      common_core.items[itemId].quantity -= price;

      applyProfileChanges.push({
        changeType: "itemQuantityChanged",
        itemId,
        quantity,
      });
    }

    for (const receiverAccountId of receiverAccountIds) {
      const receiver = await Accounts.findOne({ accountId: receiverAccountId });
      const receiverAthena = await getProfile(receiverAccountId);
      const receiverCommonCore = await getCommonCore(receiverAccountId);

      if (!receiver)
        return res.status(404).json({ error: "Receiver not found." });

      if (!receiverCommonCore.stats.attributes.allowed_to_receive_gifts) {
        return res.status(400).json({
          errorCode: "errors.com.epicgames.user.gift_disabled",
          errorMessage: `User with the accountId ${receiverAccountId} currently has receiving gifts disabled.`,
          numericErrorCode: 28004,
          error_description: `User with the accountId ${receiverAccountId} currently has receiving gifts disabled.`,
        });
      }

      for (const templateId in receiverAthena.items) {
        if (!receiverAthena.items.hasOwnProperty(templateId)) continue;

        if (receiverAthena.items.hasOwnProperty(templateId)) {
          const receivedItem = receiverAthena.items[templateId];

          if (shopData.items > 0) {
            for (const shopItem of shopData.items) {
              if (shopItem.item === receivedItem) {
                return res.status(400).json({
                  errorCode:
                    "errors.com.epicgames.modules.gamesubcatalog.purchase_not_allowed",
                  errorMessage: `User with the accountId ${receiverAccountId} already owns this item.`,
                  numericErrorCode: 28004,
                  error_description: `User with the accountId ${receiverAccountId} already owns this item.`,
                });
              }

              receiverAthena.items[itemID] = {
                templateId: shopItem.item,
                attributes: {
                  item_seen: false,
                  variants: [],
                },
                quantity: 1,
              };

              AddGift(
                {
                  templateId: giftWrapTemplateId,
                  attributes: {
                    fromAccountId: accountId,
                    lootList: [] as any[],
                    params: {
                      userMessage: personalMessage,
                    },
                    level: 1,
                    giftedOn: DateTime.now().toISO(),
                  },
                  quantity: 1,
                },
                shopItem.item,
                itemID,
                "athena",
                1
              );
            }
          }

          // If there's no content in "items"
          if (shopData.item === receivedItem) {
            return res.status(400).json({
              errorCode:
                "errors.com.epicgames.modules.gamesubcatalog.purchase_not_allowed",
              errorMessage: `User with the accountId ${receiverAccountId} already owns this item.`,
              numericErrorCode: 28004,
              error_description: `User with the accountId ${receiverAccountId} already owns this item.`,
            });
          }

          receiverAthena.items[itemID] = {
            templateId: shopData.item,
            attributes: {
              item_seen: false,
              variants: [],
            },
            quantity: 1,
          };

          AddGift(
            {
              templateId: giftWrapTemplateId,
              attributes: {
                fromAccountId: accountId,
                lootList: [] as any[],
                params: {
                  userMessage: personalMessage,
                },
                level: 1,
                giftedOn: DateTime.now().toISO(),
              },
              quantity: 1,
            },
            shopData.item,
            itemID,
            "athena",
            1
          );
        }
      }

      receiverCommonCore.items[itemID] = {
        templateId: giftWrapTemplateId,
        attributes: {
          fromAccountId: accountId,
          lootList: [] as any[],
          params: {
            userMessage: personalMessage,
          },
          level: 1,
          giftedOn: DateTime.now().toISO(),
        },
        quantity: 1,
      };

      if (receiverAccountId === accountId) {
        applyProfileChanges.push({
          changeType: "itemAdded",
          itemId: itemID,
          item: receiverCommonCore.items[itemID],
        });
      }

      GiftGlobals.GiftsReceived[receiverAccountId] = true;

      const client = (global as any).Clients.find(
        (client: any) => client.accountId === receiverAccountId
      );

      if (!client) return;

      client.socket.send(
        xmlbuilder
          .create("message")
          .attribute("from", "xmpp-admin@prod.ol.epicgames.com")
          .attribute("to", client.jid)
          .attribute("xmlns", "jabber:client")
          .attribute(
            "body",
            JSON.stringify({
              type: "com.epicgames.gift.received",
              payload: {},
              timestamp: DateTime.now().toISO(),
            })
          )
          .toString({ pretty: true })
      );
    }

    if (
      applyProfileChanges.length > 0 &&
      !receiverAccountIds.includes(accountId)
    ) {
      userProfiles.rvn += 1;
      userProfiles.commandRevision += 1;
      userProfiles.Updated = DateTime.now().toISO();
    }

    res.json({
      profileRevision: userProfiles.rvn || 0,
      profileId: "common_core",
      profileChangesBaseRevision: account.baseRevision || 0,
      profileChanges: applyProfileChanges,
      notifications: [],
      profileCommandRevision: userProfiles.commandRevision || 0,
      serverTime: DateTime.now().toISO(),
      responseVersion: 1,
    });

    if (
      applyProfileChanges.length > 0 &&
      !receiverAccountIds.includes(accountId)
    ) {
      await account
        .updateOne({ $set: { athena: userProfiles, common_core } })
        .cacheQuery();
    }
  } catch (error) {
    log.error(`An error occurred: ${error}`, "GiftCatalogEntry");
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
