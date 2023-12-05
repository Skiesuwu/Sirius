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

export let exchangeCodes: Globals["exchangeCodes"] = {};
export let clientTokens: Globals["clientTokens"] = [];
export let AccessTokens: Globals["AccessTokens"] = [];
export let Clients: Globals["Clients"] = [];
export let MUCs: Globals["MUCs"] = {};
export let parties: Globals["parties"] = [];
export let invites: Globals["invites"] = [];
export let pings: Globals["pings"] = [];

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
