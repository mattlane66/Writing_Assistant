import app from "../server/app.mjs";

export function forwardToExpress(pathname) {
  return function handler(request, response) {
    const originalUrl = request.url;
    const queryIndex = originalUrl.indexOf("?");
    const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : "";
    request.url = pathname + query;
    return app(request, response);
  };
}
