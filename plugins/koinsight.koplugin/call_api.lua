local socketutil = require("socketutil")
local ltn12 = require("ltn12")
local logger = require("logger")
local socket = require("socket")
local http = require("socket.http")
-- Guarded: if this KOReader build doesn't bundle LuaSec for some reason,
-- fall back to the old http-only behavior instead of the whole plugin
-- failing to load.
local https_ok, https = pcall(require, "ssl.https")
if not https_ok then
  https = nil
end
local UIManager = require("ui/uimanager")
local JSON = require("json")
local InfoMessage = require("ui/widget/infomessage")
local _ = require("gettext")

function response_not_valid(content)
  logger.err("[KoInsight] callApi: response was not valid JSON", content)
  UIManager:show(InfoMessage:new({
    text = _("Server response is not valid."),
  }))
end

return function(method, url, headers, body, filepath, quiet)
  quiet = quiet or false

  local sink = {}
  local request = {
    method = method,
  }

  request.url = url
  request.headers = headers or {}

  request.sink = ltn12.sink.table(sink)
  socketutil:set_timeout(socketutil.LARGE_BLOCK_TIMEOUT, socketutil.LARGE_TOTAL_TIMEOUT)

  if body ~= nil then
    request.source = ltn12.source.string(body)
  end

  logger.dbg("[KoInsight] callApi:", request.method, request.url)

  -- ssl.https mirrors socket.http's request() signature, so this is a
  -- drop-in swap based on scheme. Plain socket.http has no TLS support at
  -- all: pointed at an https:// URL it fails the request silently instead
  -- of erroring loudly, which is why this dispatch has to happen here
  -- rather than relying on a single client to handle both schemes.
  local requester = (request.url:match("^https:") and https) or http
  local code, resp_headers, status = socket.skip(1, requester.request(request))
  socketutil:reset_timeout()

  -- Raise error if network is unavailable
  if resp_headers == nil then
    logger.err("[KoInsight] callApi: network error", status or code)
    if not quiet then
      UIManager:show(InfoMessage:new({
        text = _("Could not reach the KoInsight server. Check the server URL and your network connection."),
      }))
    end
    return false, "network_error"
  end

  -- If the request returned successfully
  if code == 200 then
    local content = table.concat(sink)

    if content == nil or content == "" or string.sub(content, 1, 1) ~= "{" then
      response_not_valid(content)
      return false, "empty_response"
    end

    local ok, result = pcall(JSON.decode, content)

    if ok and result then
      return true, result
    else
      response_not_valid(content)
      return false, "invalid_response"
    end
  else
    if not quiet then
      logger.err("[KoInsight] callApi: HTTP error", status or code, resp_headers, result)
      UIManager:show(InfoMessage:new({
        text = _("Server error" .. (result and ": " .. result["error"] or "")),
      }))
    end

    logger.err("[KoInsight] callApi: HTTP error", status or code, resp_headers)
    return false, "http_error", code
  end
end
