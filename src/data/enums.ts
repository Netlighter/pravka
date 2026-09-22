export const DESYNC_MODES = [
  "synack",
  "syndata",
  "fake",
  "fakeknown",
  "rst",
  "rstack",
  "hopbyhop",
  "destopt",
  "ipfrag1",
  "multisplit",
  "multidisorder",
  "fakedsplit",
  "hostfakesplit",
  "fakeddisorder",
  "ipfrag2",
  "udplen",
  "tamper",
] as const;

export const FOOLING = [
  "none",
  "md5sig",
  "badseq",
  "badsum",
  "datanoack",
  "ts",
  "hopbyhop",
  "hopbyhop2",
] as const;

export const L7_PROTOS = [
  "http",
  "tls",
  "quic",
  "wireguard",
  "dht",
  "discord",
  "stun",
  "unknown",
] as const;

export const SPLIT_MARKERS = [
  "method",
  "host",
  "endhost",
  "sld",
  "endsld",
  "midsld",
  "sniext",
] as const;

export const IP_ID_MODES = ["seq", "seqgroup", "rnd", "zero", "same"] as const;

export const L3 = ["ipv4", "ipv6"] as const;

export const FAKE_TLS_MODS = ["none", "rnd", "rndsni", "dupsid", "padencap"] as const;

export const FAKE_TCP_MODS = ["none", "seq"] as const;

export const TCP_FLAGS = [
  "FIN",
  "SYN",
  "RST",
  "PSH",
  "ACK",
  "URG",
  "ECE",
  "CWR",
  "AE",
  "R1",
  "R2",
  "R3",
] as const;

export const BATCH_KEYWORDS = [
  "echo",
  "set",
  "call",
  "start",
  "cd",
  "if",
  "else",
  "goto",
  "exit",
  "pause",
  "title",
  "chcp",
  "rem",
  "for",
  "do",
  "nul",
  "off",
  "on",
  "min",
  "max",
] as const;

export const CUTOFF_PREFIXES = ["n", "d", "s"] as const;
