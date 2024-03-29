import { Router } from "express";
import verifyToken from "../middleware/verifyToken";
import Cache from "../middleware/Cache";

export default function initRoute(router: Router): void {
  router.get(
    "/fortnite/api/storefront/v2/keychain",
    Cache,
    verifyToken,
    async (req, res) => {
      res.json(require("../common/resources/storefront/keychain.json"));
    }
  );
}
