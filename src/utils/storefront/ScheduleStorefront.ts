import { DateTime } from "luxon";
import log from "../log";
import Shop from "./generator/Shop";
import { SavedData } from "./types/ShopTypes";
import { SendWebhook } from "../discord/SendShopWebhook";
import { getEnv } from "../getEnv";

export default async function Schedule(maxAttempts?: number): Promise<void> {
  let attempts = 0;
  let hasLoggedSchedulingMessage = false;

  while (attempts < (maxAttempts || 5)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!hasLoggedSchedulingMessage) {
      hasLoggedSchedulingMessage = true;
    }

    if (getEnv("AutoRotate") === "true") {
      const now = DateTime.utc();
      const targetTime = DateTime.utc().startOf("day").plus({ days: 1 });

      targetTime.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

      if (now > targetTime) {
        targetTime.plus({ days: 1 });
      }

      const delayMilliseconds = targetTime.diff(now).as("milliseconds");

      await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));

      const savedData = {
        weekly: [],
        weeklyFields: [],
        daily: [],
        dailyFields: [],
      };

      await Shop.Initialize(savedData);

      await SendWebhook(savedData);

      log.log(
        `Next shop Generates at ${DateTime.utc().toISO()} UTC.`,
        "Schedule",
        "green"
      );

      attempts++;
      break;
    } else {
      log.warn("AutoRotate is disabled.", "Schedule");
      const savedData: SavedData = {
        weekly: [],
        weeklyFields: [],
        daily: [],
        dailyFields: [],
      };

      // await new Promise((resolve) => setTimeout(resolve, 10000));
      await Shop.Initialize(savedData);
      await SendWebhook(savedData);

      attempts++;
      break;
    }
  }
}
