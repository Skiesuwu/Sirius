import fs from "node:fs/promises";
import path from "node:path";
import Accounts from "../../../models/Accounts";

export async function getProfile(accountId: string) {
  const existingProfile = await Accounts.findOne({ accountId }).lean();

  if (!existingProfile) {
    return { error: "not found" };
  }

  return existingProfile.athena;
}

export async function getCommonCore(accountId: string) {
  const existingProfile = await Accounts.findOne({ accountId }).lean();

  if (!existingProfile) {
    return { error: "not found" };
  }

  return existingProfile.common_core;
}

export async function getMeta(accountId: string) {
  const existingProfile = await Accounts.findOne({ accountId }).lean();

  if (!existingProfile) {
    return { error: "not found" };
  }

  return existingProfile.metadata;
}

export async function getOupost(accountId: string) {
  const existingProfile = await Accounts.findOne({ accountId }).lean();

  if (!existingProfile) {
    return { error: "not found" };
  }

  return existingProfile.outpost0;
}

export async function getTheater(accountId: string) {
  const existingProfile = await Accounts.findOne({ accountId }).lean();

  if (!existingProfile) {
    return { error: "not found" };
  }

  return existingProfile.theater0;
}

export async function getBook(type: string, accountId: string) {
  const existingProfile = await Accounts.findOne({ accountId }).lean();

  if (!existingProfile) {
    return { error: "not found" };
  }

  switch (type) {
    case "collection_book_schematics0":
      return existingProfile.collection_book_schematics0;
    case "collection_book_people0":
      return existingProfile.collection_book_people0;
  }
}
