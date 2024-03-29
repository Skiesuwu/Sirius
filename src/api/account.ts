import { Router } from "express";
import Users from "../models/Users";
import log from "../utils/log";
import verifyToken from "../middleware/verifyToken";
import { DateTime } from "luxon";
import Cache from "../middleware/Cache";

export default function initRoute(router: Router): void {
  router.get(
    "/account/api/public/account/:accountId",
    Cache,
    verifyToken,
    async (req, res) => {
      const { accountId } = req.params;
      const user = await Users.findOne({ accountId }).cacheQuery();

      try {
        if (!user) {
          return res.json({});
        } else if (user.banned) {
          return res.json({});
        }

        return res.json({
          id: user.accountId,
          displayName: user.username,
          name: user.username,
          email: user.email,
          failedLoginAttempts: 0,
          lastLogin: DateTime.utc().toFormat("yyyy-MM-ddTHH:mm:ss.SSS'Z'"),
          numberOfDisplayNameChanges: 0,
          ageGroup: "UNKNOWN",
          headless: false,
          country: "US",
          lastName: "User",
          links: {},
          preferredLanguage: "en",
          canUpdateDisplayName: false,
          tfaEnabled: true,
          emailVerified: true,
          minorVerified: true,
          minorExpected: true,
          minorStatus: "UNKNOWN",
        });
      } catch (error) {
        let err: Error = error as Error;
        log.error(
          `Error while fetching public account information:  ${err.message}`,
          "Account"
        );
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );

  router.get(
    "/account/api/public/account",
    Cache,
    verifyToken,
    async (req, res) => {
      try {
        const accountIdQuery = req.query.accountId?.toString();

        if (!accountIdQuery) {
          return res.status(404).json([]);
        }

        const response: any[] = [];

        if (accountIdQuery!.includes(",")) {
          const accountIds: string[] = accountIdQuery.split(",");

          for (const accountId of accountIds) {
            const user = await Users.findOne({ accountId }).cacheQuery();

            if (!user) {
              return res.status(404).json({ error: "User not found." });
            }

            response.push({
              id: user.accountId,
              displayName: user.username,
              externalAuth: {},
            });
          }
        } else {
          const user = await Users.findOne({
            accountId: accountIdQuery,
          }).cacheQuery();

          if (!user) {
            return res.status(404).json({ error: "User not found." });
          }

          response.push({
            id: user.accountId,
            links: {},
            displayName: user.username,
            cabinedMode: false,
            externalAuth: {},
          });
        }

        return res.json(response);
      } catch (error) {
        const err: Error = error as Error;
        log.error(
          `Error while fetching public account information: ${err.message}`,
          "Account"
        );
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );

  router.get("/fortnite/api/game/v2/world/info", async (req, res) => {
    // why does this crash ????
    res.json({});
  });

  router.post(
    "/fortnite/api/game/v2/tryPlayOnPlatform/account/*",
    Cache,
    verifyToken,
    async (req, res) => {
      res.setHeader("Content-Type", "text/plain").send(true).end();
    }
  );

  router.get(
    "/fortnite/api/game/v2/enabled_features",
    Cache,
    verifyToken,
    async (req, res) => {
      res.json([]);
    }
  );

  router.get(
    "/account/api/public/account/:accountId/externalAuths",
    Cache,
    verifyToken,
    async (req, res) => {
      res.json([]);
    }
  );

  router.get(
    "/account/api/public/account/displayName/:displayName",
    Cache,
    verifyToken,
    async (req, res) => {
      const { displayName } = req.params;
      const user = await Users.findOne({
        username: displayName,
      }).cacheQuery();

      if (!user) {
        return res.status(404).json({
          errorCode: "errors.com.epicgames.account.account_not_found",
          errorMessage: `Sorry, we couldn't find an account for ${displayName}`,
          messageVars: undefined,
          numericErrorCode: 18007,
          originatingService: "any",
          intent: "prod",
          error_description: `Sorry, we couldn't find an account for ${displayName}`,
          error: "account_not_found",
        });
      }

      res.json({
        id: user.accountId,
        displayName,
        externalAuths: {},
      });
    }
  );

  router.get("/account/api/epicdomains/ssodomains", (req, res) => {
    res.json(["fortnite.com", "epicgames.com"]);
  });

  router.get("/account/api/accounts/:accountId/metadata", (req, res) => {
    res.json({
      FGOnboarded: true,
    });
  });
}
