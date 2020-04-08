import { safeSerialize } from './utils';

export function renderGraphiQL({
  defaultQuery,
  path,
}: {
  defaultQuery?: string;
  path: string;
}) {
  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>GraphiQL</title>
      <meta name="robots" content="noindex" />
      <meta name="referrer" content="origin" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script src="https://unpkg.com/react/umd/react.development.js" crossorigin></script>
      <script src="https://unpkg.com/react-dom/umd/react-dom.development.js" crossorigin></script>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/graphiql/graphiql.min.css" crossorigin />
      <script src="https://unpkg.com/graphiql/graphiql.min.js" crossorigin></script>
      <style>
        body {
          margin: 0;
          overflow: hidden;
        }
        #graphiql {
          height: 100vh;
        }
      </style>
    </head>
    <body>
      <div id="graphiql">Loading...</div>
      <script>
        const URL = "${path}";
        // Defines a GraphQL fetcher using the fetch API.
        function graphQLFetcher(graphQLParams) {
          return fetch(URL, {
            method: "post",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(graphQLParams)
          }).then(response => response.json());
        }
        ReactDOM.render(
          React.createElement(GraphiQL, {
            fetcher: graphQLFetcher,
            defaultQuery: ${safeSerialize(defaultQuery) || '""'},
          }),
          document.getElementById('graphiql')
        );
      </script>
    </body>
  </html>`;
}
