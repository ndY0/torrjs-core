class ServerEvent {
  constructor(
    public action: string,
    public data: Record<string | number | symbol, any>,
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

export { ServerEvent, ReplyTypes, ServerReply };
