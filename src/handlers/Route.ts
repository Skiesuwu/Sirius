import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Application, NextFunction, Request, Response, Router } from "express";
import log from "../utils/log";

/**
 * Dynamically initializes routes in an Express application from route modules.
 * @param {Application} app - The Express application to which routes will be attached.
 * @returns {Promise<void>} A promise that resolves when all routes are initialized.
 */
export default {
  async initializeRoutes(app: Application): Promise<void> {
    try {
      const routesPath = join(__dirname, "..", "api");
      const files = readdirSync(routesPath).filter(
        (file) => file.endsWith(".ts") || file.endsWith(".js")
      );

      await Promise.all(
        files.map(async (file) => {
          try {
            const RouteModule = await import(
              join(__dirname, "..", "api", file)
            );

            if (
              RouteModule.default &&
              typeof RouteModule.default === "function"
            ) {
              try {
                RouteModule.default(app);
              } catch (error) {
                let err = error as Error;
                log.error(
                  `Error in route ${file}: ${err.message}`,
                  "RouteHandler"
                );
              }
            } else {
              log.error(
                `${file} does not export a valid route initializer`,
                "RouteHandler"
              );
            }
          } catch (error) {
            let err = error as Error;
            log.error(
              `Error loading route ${file}: ${err.message}`,
              "RouteHandler"
            );
          }
        })
      );
    } catch (error) {
      let err = error as Error;
      log.error(`Error initializing routes: ${err.message}`, "RouteHandler");
      throw error;
    }
  },
};
