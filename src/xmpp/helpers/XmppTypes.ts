import XmppClient from "../client/XmppClient";

export interface AccessToken {
  accountId: string;
  token: string;
}

export interface XmppClients extends AccessToken {
  accountId: string;
  displayName?: string;
  token: string;
  socket?: XmppClient;
}

export interface MUCs {
  members: [];
}

export interface Globals {
  exchangeCodes: Record<string, any>;
  clientTokens: any[];
  AccessTokens: AccessToken[];
  Clients: XmppClients[]; // Updated type to XmppClients[]
  MUCs: Record<string, any>;
  parties: any[];
  invites: any[];
  pings: any[];
}

export const exchangeCodes: Globals["exchangeCodes"] = {};
export const clientTokens: Globals["clientTokens"] = [];
export const AccessTokens: Globals["AccessTokens"] = [];
export const Clients: Globals["Clients"] = [];
export const MUCs: Globals["MUCs"] = {};
export const parties: Globals["parties"] = [];
export const invites: Globals["invites"] = [];
export const pings: Globals["pings"] = [];

export const Globals: Globals = {
  exchangeCodes,
  clientTokens,
  AccessTokens,
  Clients,
  MUCs,
  parties,
  invites,
  pings,
};