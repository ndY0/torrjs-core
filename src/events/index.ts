class ServerEvent {
  constructor(
    public action: string,
    public data: Record<string | number | symbol, any>,
    public caller?: string
  ) {}
}

export { ServerEvent };
