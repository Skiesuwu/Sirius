import fs from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import { v4 as uuid } from "uuid";
import Accounts from "../../../../models/Accounts";
import { getSeason } from "../../../../utils";
import log from "../../../../utils/log";
import { getCommonCore, getProfile } from "../../utils/getProfile";
import { json } from "../../../../api/storefront";
import { Tier } from "../../../../interface";
import AccountRefresh from "../../../../utils/AccountRefresh";
import Users from "../../../../models/Users";

interface ProfileChange {
  changeType: string;
  itemId: string;
  quantity: number;
}

export default async function PurchaseCatalogEntry(
  accountId: string,
  profileId: string,
  rvn: number,
  req: any,
  res: any
) {
  try {
    const { currency, offerId, purchaseQuantity, expectedTotalPrice } =
      req.body;
    const userAgent = req.headers["user-agent"];
    const season = getSeason(userAgent);

    const shopPath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "resources",
      "storefront",
      "shop.json"
    );

    const shop = JSON.parse(await fs.readFile(shopPath, "utf-8"));

    const battlePass = `Season${season?.season}BattlePass.json`;
    const freeRewardsName = `Season${season?.season}FreeRewards.json`;
    const paidRewardsName = `Season${season?.season}PaidRewards.json`;

    const battlepassData = await json(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "resources",
        "storefront",
        "battlepasses",
        battlePass
      )
    );

    const freeRewards = await json(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "resources",
        "storefront",
        "battlepasses",
        "BattlePassRewards",
        "Free",
        freeRewardsName
      )
    );

    const paidRewards = await json(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "resources",
        "storefront",
        "battlepasses",
        "BattlePassRewards",
        "Paid",
        paidRewardsName
      )
    );

    let catalogEntriesData: any = null;

    for (const entry of battlepassData.catalogEntries) {
      catalogEntriesData = entry;
    }

    const account = await Accounts.findOne({ accountId });
    const user = await Users.findOne({ accountId });

    const applyProfileChanges: any[] = [];
    const notifications: any[] = [];
    const multiUpdate: any[] = [];

    if (!account || !user) {
      return res.status(404).json({
        errorMessage: "Account or User not found.",
      });
    }

    const userProfiles = await getProfile(accountId);
    const commonCore = await getCommonCore(accountId);
    let isItemOwned: boolean = false;

    if (currency === "MtxCurrency" && profileId === "common_core") {
      if (!offerId || offerId === null) {
        return res.status(400).json({
          errorCode: "errors.com.epicgames.fortnite.id_invalid",
          errorMessage: `Offer ID (${offerId}) not found.`,
          messageVars: undefined,
          numericErrorCode: 1040,
          originatingService: "any",
          intent: "prod",
          error_description: `Offer ID (${offerId}) not found.`,
          error: undefined,
        });
      }

      if (offerId.includes(":/")) {
        const id: string = offerId.split(":/")[1];
        let matchedStorefront: any = null;

        for (const storefront of shop.catalogItems.BRDailyStorefront) {
          if (storefront.id === id) {
            matchedStorefront = storefront;
          }
        }

        for (const storefront of shop.catalogItems.BRWeeklyStorefront) {
          if (storefront.id === id) {
            matchedStorefront = storefront;
          }
        }

        if (purchaseQuantity < 1) {
          return res.status(400).json({
            errorCode: "errors.com.epicgames.validation.validation_failed",
            errorMessage:
              "Validation Failed. 'purchaseQuantity' is less than 1.",
            messageVars: undefined,
            numericErrorCode: 1040,
            originatingService: "any",
            intent: "prod",
            error_description:
              "Validation Failed. 'purchaseQuantity' is less than 1.",
            error: undefined,
          });
        }

        if (!matchedStorefront) {
          return res.status(400).json({
            errorCode: "errors.com.epicgames.fortnite.invalid_item_id",
            errorMessage: "Failed to retrieve item from the current shop.",
            messageVars: undefined,
            numericErrorCode: 1040,
            originatingService: "any",
            intent: "prod",
            error_description: "Failed to retrieve item from the current shop.",
            error: undefined,
          });
        } else {
          if (isItemOwned) {
            return res.status(400).json({
              errorCode: "errors.com.epicgames.offer.already_owned",
              errorMessage: "You have already bought this item before.",
              messageVars: undefined,
              numericErrorCode: 1040,
              originatingService: "any",
              intent: "prod",
              error_description: "You have already bought this item before.",
              error: undefined,
            });
          } else {
            const itemUUID = uuid();

            for (const item of matchedStorefront.items) {
              if (item.item === userProfiles.items[item.item]) {
                return res.status(400).json({
                  errorCode: "errors.com.epicgames.offer.already_owned",
                  errorMessage: "You have already bought this item before.",
                  messageVars: undefined,
                  numericErrorCode: 1040,
                  originatingService: "any",
                  intent: "prod",
                  error_description:
                    "You have already bought this item before.",
                  error: undefined,
                });
              }

              userProfiles.items[item.item] = {
                templateId: item.item,
                attributes: {
                  item_seen: false,
                  variants: [],
                },
                quantity: 1,
              };

              multiUpdate.push({
                changeType: "itemAdded",
                itemId: itemUUID,
                item: userProfiles.items[item.item],
              });

              notifications.push({
                itemType: item.item,
                itemGuid: itemUUID,
                itemProfile: "athena",
                quantity: 1,
              });
            }

            userProfiles.items[matchedStorefront.item] = {
              templateId: matchedStorefront.item,
              attributes: {
                item_seen: false,
                variants: [],
              },
              quantity: 1,
            };

            multiUpdate.push({
              changeType: "itemAdded",
              itemId: itemUUID,
              item: userProfiles.items[matchedStorefront.item],
            });

            notifications.push({
              itemType: matchedStorefront.item,
              itemGuid: itemUUID,
              itemProfile: "athena",
              quantity: 1,
            });
          }

          let quantity = commonCore.items["Currency:MtxPurchased"].quantity;

          for (const item of commonCore.items) {
            quantity -= matchedStorefront.price;
            const itemUUID = uuid();

            applyProfileChanges.push({
              changeType: "itemAttrChanged",
              itemId: "Currency:MtxPurchased",
              quantity,
            });

            commonCore.stats.attributes["mtx_purchase_history"] = {
              refundsUsed: 0,
              refundCredits: 3,
              tokenRefreshReferenceTime: DateTime.now().toISO(),
              purchases: [
                {
                  purchaseId: uuid(),
                  offerId,
                  purchaseDate: DateTime.now().toISO(),
                  refundDate: DateTime.now().toISO(),
                  undoTimeout: "9999-12-12T00:00:00.000Z",
                  freeRefundEligible: true,
                  fulfillments: [],
                  lootResult: [
                    {
                      itemType: matchedStorefront.item,
                      itemGuid: itemUUID,
                      itemProfile: "athena",
                      quantity,
                    },
                  ],
                  totalMtxPaid: expectedTotalPrice,
                  metadata: {},
                  gameContext: "",
                },
              ],
            };

            isItemOwned = true;
          }
        }

        if (!isItemOwned && matchedStorefront.price > 0) {
          return res.status(400).json({
            errorCode: "errors.com.epicgames.currency.mtx.insufficient",
            errorMessage: `You can not afford this item (${matchedStorefront.price}).`,
            messageVars: undefined,
            numericErrorCode: 1040,
            originatingService: "any",
            intent: "prod",
            error_description: `You can not afford this item (${matchedStorefront.price}).`,
            error: undefined,
          });
        }
      }
    }

    // BattlePass Purchasing
    for (const entry of battlepassData.catalogEntries) {
      catalogEntriesData = entry;

      if (offerId === catalogEntriesData.offerId) {
        let quantity = commonCore.items["Currency:MtxPurchased"].quantity;

        let book_level: number = userProfiles.stats.attributes.book_level;
        const isBattlePass =
          catalogEntriesData.devName ===
          `BR.Season${season?.season}.BattlePass.01`;

        const isBattleBundle =
          catalogEntriesData.devName ===
          `BR.Season${season?.season}.BattleBundle.01`;
        const isSingleTier =
          catalogEntriesData.devName ===
          `BR.Season${season?.season}.SingleTier.01`;

        let newLevel: number;
        if (isBattlePass) {
          newLevel = Math.min(book_level + 1, 100);
        if (isBattleBundle) {
          newLevel = Math.min(book_level + 25, 100);
        } else if (isSingleTier) {
          newLevel = Math.min(book_level + purchaseQuantity, 100);
        }

        const EndingbookLevel = (userProfiles.stats.attributes.book_level =
          newLevel);

        if (!isSingleTier) {
          if (quantity) {
            quantity -= catalogEntriesData.prices[0].finalPrice;

            applyProfileChanges.push({
              changeType: "itemAttrChanged",
              itemId: "Currency:MtxPurchased",
              quantity,
            });

            isItemOwned = true;
          }

          if (!isItemOwned && catalogEntriesData.prices[0].finalPrice > 0) {
            return res.status(400).json({
              errorCode: "errors.com.epicgames.currency.mtx.insufficient",
              errorMessage: `You can not afford this item (${catalogEntriesData.prices[0].finalPrice}).`,
              messageVars: undefined,
              numericErrorCode: 1040,
              originatingService: "any",
              intent: "prod",
              error_description: `You can not afford this item (${catalogEntriesData.prices[0].finalPrice}).`,
              error: undefined,
            });
          }

          userProfiles.stats.attributes.book_purchased = true;
          multiUpdate.push({
            changeType: "statModified",
            name: "book_purchased",
            value: userProfiles.stats.attributes.book_purchased,
          });
        }

        let finalPrice: number = 0;
        for (let i = book_level; i < EndingbookLevel; i++) {
          const paidTiers = paidRewards.filter(
            (t: { Tier: number }) => t.Tier == i + 1
          );
          const freeTiers = freeRewards.filter(
            (t: { Tier: number }) => t.Tier == i + 1
          );

          function GrantBattlePassTier(
            entry: { Item: string; Quantity: number; Tier: number },
            paid: boolean
          ) {
            var item = entry.Item;
            var count = entry.Quantity;
            var id = uuid();

            if (paid) finalPrice += catalogEntriesData.prices[0].finalPrice;
            if (
              item.toLowerCase().startsWith("athena") ||
              item.toLowerCase().startsWith("homebasebanner") ||
              item.toLowerCase().startsWith("challengebundleschedule")
            ) {
              var exists = false;
              for (var key in userProfiles.items) {
                if (
                  userProfiles.items[key].templateId.toLowerCase() ==
                  item.toLowerCase()
                ) {
                  exists = true;
                  break;
                }
              }

              if (!exists) {
                const newItemTemplate = item
                  .toLowerCase()
                  .startsWith("homebasebanner")
                  ? {
                      templateId: item,
                      attributes: { itemSeen: false },
                      quantity: 1,
                    }
                  : {
                      templateId: item,
                      attributes: {
                        maxLevelBonus: 0,
                        level: 1,
                        itemSeen: false,
                        xp: 0,
                        variants: [],
                        favorite: false,
                      },
                      quantity: count,
                    };

                userProfiles.items[id] = newItemTemplate;
                multiUpdate.push({
                  changeType: "itemAdded",
                  itemId: id,
                  item: userProfiles.items[id],
                });
              }

              notifications.push({
                itemType: item,
                itemGuid: id,
                quantity: count,
              });
            } else {
              switch (item.toLowerCase()) {
                case "token:athenaseasonxpboost":
                  if (
                    Number.isNaN(
                      userProfiles.stats.attributes.season_match_boost
                    )
                  )
                    userProfiles.stats.attributes.season_match_boost = 0;
                  userProfiles.stats.attributes.season_match_boost += count;

                  multiUpdate.push({
                    changeType: "statModified",
                    name: "season_match_boost",
                    value: userProfiles.stats.attributes.season_match_boost,
                  });
                  break;
                case "token:athenaseasonfriendxpboost":
                  if (
                    Number.isNaN(
                      userProfiles.stats.attributes.season_friend_match_boost
                    )
                  )
                    userProfiles.stats.attributes.season_friend_match_boost = 0;
                  userProfiles.stats.attributes.season_friend_match_boost +=
                    count;

                  multiUpdate.push({
                    changeType: "statModified",
                    name: "season_friend_match_boost",
                    value:
                      userProfiles.stats.attributes.season_friend_match_boost,
                  });
                  break;
                case "currency:mtxgiveaway":
                  for (var key in commonCore.items) {
                    if (
                      String(commonCore.items[key].templateId)
                        .toLowerCase()
                        .startsWith("currency:mtx")
                    ) {
                      commonCore.items[key].quantity += count;

                      applyProfileChanges.push({
                        changeType: "itemAttrChanged",
                        itemId: commonCore.items[key].templateId,
                        quantity: commonCore.items[key].quantity,
                      });
                    }
                  }
                  break;
              }
            }
          }

          for (var itemEntry of paidTiers) {
            GrantBattlePassTier(itemEntry, true);
          }

          for (var itemEntry of freeTiers) {
            GrantBattlePassTier(itemEntry, false);
          }

          if (finalPrice > quantity && isSingleTier) {
            return res.status(400).json({
              errorCode: "errors.com.epicgames.currency.mtx.insufficient",
              errorMessage: `You can not afford this item (${finalPrice}).`,
              messageVars: undefined,
              numericErrorCode: 1040,
              originatingService: "any",
              intent: "prod",
              error_description: `You can not afford this item (${finalPrice}).`,
              error: undefined,
            });
          }
        }
        if (isSingleTier)
          commonCore.items["Currency:MtxPurchased"].quantity -= finalPrice;

        applyProfileChanges.push({
          changeType: "itemAttrChanged",
          itemId: "Currency:MtxPurchased",
          quantity: commonCore.items["Currency:MtxPurchased"].quantity,
        });

        multiUpdate.push({
          changeType: "statModified",
          name: "book_level",
          value: EndingbookLevel,
        });

        if (season?.season! >= 11) {
          userProfiles.stats.attributes.level = EndingbookLevel;
          userProfiles.stats.attributes.accountLevel +=
            userProfiles.stats.attrobt;
        } else {
          userProfiles.stats.attributes.accountLevel += EndingbookLevel;
        }

        if (purchaseQuantity >= 100) {
          return res.status(400).json({
            errorCode: "errors.com.epicgames.offer.limit_reached",
            errorMessage:
              "You've already unlocked all the tiers of this Battle Pass.",
            messageVars: undefined,
            numericErrorCode: 28000,
            originatingService: "any",
            intent: "prod",
            error_description:
              "You've already unlocked all the tiers of this Battle Pass.",
            error: undefined,
          });
        }
      }
    }

    if (applyProfileChanges.length > 0 && multiUpdate.length > 0) {
      userProfiles.rvn += 1;
      userProfiles.commandRevision += 1;
      userProfiles.Updated = DateTime.utc().toISO();

      commonCore.rvn += 1;
      commonCore.commandRevision += 1;
      commonCore.Updated = DateTime.utc().toISO();
    }

    res.json({
      profileRevision: account.profilerevision,
      profileId,
      profileChangesBaseRevision: account.baseRevision,
      profileChanges: applyProfileChanges,
      notifications: [
        {
          type: "CatalogPurchase",
          primary: true,
          lootResult: {
            items: notifications,
          },
        },
      ],
      profileCommandRevision: account.RVN,
      serverTime: DateTime.now().toISO(),
      multiUpdate: [
        {
          profileRevision: userProfiles.rvn,
          profileId,
          profileChangesBaseRevision: account.baseRevision,
          profileChanges: multiUpdate,
          profileCommandRevision: userProfiles.commandRevision,
        },
      ],
      responseVersion: 1,
    });

    if (applyProfileChanges.length > 0 && multiUpdate.length > 0) {
      await account.updateOne({
        $set: {
          athena: userProfiles,
          common_core: commonCore,
        },
      });
    }
  } catch (error) {
    log.error(`${error}`, "PurchaseCatalogEntry");
  }
}
