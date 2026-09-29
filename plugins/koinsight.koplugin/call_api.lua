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

-- Right after Wi-Fi is switched on (aggressive sync on suspend), NetworkMgr can
-- report "connected" before the device has an address or a route, so the first
-- request fails instantly with one of these. They all mean the request never
-- left the device, so retrying is safe and cheap. A timeout is deliberately not
-- listed: the server may already be processing that request.
local NOT_YET_ONLINE_ERRORS = {
  "Network is unreachable",
  "No route to host",
  "host or service not provided",
}
local NETWORK_ATTEMPTS = 3
local NETWORK_RETRY_DELAY_S = 1

local function is_not_yet_online(err)
  if type(err) ~= "string" then
    return false
  end
  for _, pattern in ipairs(NOT_YET_ONLINE_ERRORS) do
    if err:find(pattern, 1, true) then
      return true
    end
  end
  return false
end

return function(method, url, headers, body, filepath, quiet)
  quiet = quiet or false

  local sink, code, resp_headers, status

  for attempt = 1, NETWORK_ATTEMPTS do
    -- Sink and source are consumed by a request, so each attempt needs fresh ones.
    sink = {}
    local request = {
      method = method,
      url = url,
      headers = headers or {},
      sink = ltn12.sink.table(sink),
    }

    if body ~= nil then
      request.source = ltn12.source.string(body)
    end

    logger.dbg("[KoInsight] callApi:", request.method, request.url)

    socketutil:set_timeout(socketutil.LARGE_BLOCK_TIMEOUT, socketutil.LARGE_TOTAL_TIMEOUT)
    -- ssl.https mirrors socket.http's request() signature, so this is a
    -- drop-in swap based on scheme. Plain socket.http has no TLS support at
    -- all: pointed at an https:// URL it fails the request silently instead
    -- of erroring loudly, which is why this dispatch has to happen here
    -- rather than relying on a single client to handle both schemes.
    local requester = (request.url:match("^https:") and https) or http
    code, resp_headers, status = socket.skip(1, requester.request(request))
    socketutil:reset_timeout()

    if resp_headers ~= nil or attempt == NETWORK_ATTEMPTS or not is_not_yet_online(code) then
      break
    end

    logger.warn(
      "[KoInsight] callApi: network not ready (" .. tostring(code) .. "), retrying",
      attempt .. "/" .. (NETWORK_ATTEMPTS - 1)
    )
    socket.sleep(NETWORK_RETRY_DELAY_S)
  end

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
