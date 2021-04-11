class ServerEvent<T = Record<string | number | symbol, any>> {
  constructor(
    public action: string,
    public data: T[],
    public caller?: string
  ) {}
}

enum ReplyTypes {
  NO_REPLY,
  REPLY,
}

type ServerReply =
  | { type: ReplyTypes.NO_REPLY; newState: any }
  | { type: ReplyTypes.REPLY; reply: any; newState: any };

type RegistryAction = { selector: string } | { key: string; value: string };

export { ServerEvent, ReplyTypes, ServerReply, RegistryAction };
