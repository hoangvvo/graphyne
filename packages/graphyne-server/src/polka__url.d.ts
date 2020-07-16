declare module '@polka/url' {
  import { IncomingMessage } from 'http';
  export default function (
    req: IncomingMessage,
    toDecode: true
  ): {
    path: string;
    pathname: string;
    search: string;
    query: { [key: string]: string };
    href: string;
    _raw: string;
  };
}
