import { getEnv } from "../utils";
import mongoose from "mongoose";
import log from "../utils/log";
import { applySpeedGooseCacheLayer, SharedCacheStrategies } from "speedgoose";

const DB_URL = getEnv("DATABASE_URL");

const connectToDatabase = async () => {
  for (let i = 0; i < 3; i++) {
    try {
      mongoose
        .connect(DB_URL, { maxPoolSize: 10, maxIdleTimeMS: 30000 })
        .then(async () => {
          await applySpeedGooseCacheLayer(mongoose, {
            sharedCacheStrategy: SharedCacheStrategies.IN_MEMORY,
            debugConfig: {
              enabled: false,
            },
            defaultTtl: 3600,
          });
        });
      log.log("Connected to MongoDB", "Database", "magentaBright");
      break;
    } catch (error) {
      let err = error as Error;
      log.error(`MongoDB Connection Error: ${err.message}`, "Database");
      if (i < 2) {
        log.log(
          `Retrying connection (${i + 1})...`,
          "Database",
          "magentaBright"
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw error;
      }
    }
  }
};

export default {
  connect: connectToDatabase,
};
