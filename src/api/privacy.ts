import { Router } from "express";
import Accounts from "../models/Accounts";

export default function initRoute(router: Router) {
  router.get(
    "/fortnite/api/game/v2/privacy/account/:accountId",
    async (req, res) => {
      const { accountId } = req.params;

      const account = await Accounts.findOne({ accountId }).cacheQuery();

      if (!account) {
        return res.status(404).json({ error: "Failed to find Account." });
      }

      res.json({
        accountId: account.accountId,
        optOutOfPublicLeaderboards: account.optOutOfPublicLeaderboards,
        acceptInvites: "public",
        acceptInvitesFrom: "public",
        joinConfirmation: "public",
        joinability: "open",
        partyType: "PUBLIC",
      });
    }
  );

  router.post(
    "/fortnite/api/game/v2/privacy/account/:accountId",
    async (req, res) => {
      const { accountId } = req.params;

      const account = await Accounts.findOne({ accountId }).cacheQuery();

      if (!account) {
        return res.status(404).json({ error: "Failed to find Account." });
      }

      res.json({
        accountId: account.accountId,
        optOutOfPublicLeaderboards: account.optOutOfPublicLeaderboards,
        acceptInvites: "public",
        acceptInvitesFrom: "public",
        joinConfirmation: "public",
        joinability: "open",
        partyType: "PUBLIC",
      });
    }
  );
}
