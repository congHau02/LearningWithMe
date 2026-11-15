-- Atomically locks a Seat in room:{roomId}:seats and elects initial Table Host in table:{roomId}:{tableId}:state
-- KEYS[1]: room:{roomId}:seats
-- KEYS[2]: table:{roomId}:{tableId}:state
-- ARGV[1]: seatId
-- ARGV[2]: userId
-- ARGV[3]: initial RedisTableState JSON (with hostUserId = userId)
-- Return:
--   "1:<hostUserId>": successfully locked and resolved hostUserId
--   "0": seat is already occupied by someone else
--   "-1": user is already occupying a seat in this room

local seatsKey = KEYS[1]
local tableStateKey = KEYS[2]
local seatId = ARGV[1]
local userId = ARGV[2]
local initialTableJson = ARGV[3]

local allSeats = redis.call('HGETALL', seatsKey)
local seatedUsers = {}
for i = 1, #allSeats, 2 do
    local occupant = allSeats[i + 1]
    if occupant == userId then
        return '-1'
    end
    seatedUsers[occupant] = true
end

local setOk = redis.call('HSETNX', seatsKey, seatId, userId)
if setOk == 0 then
    return '0'
end

local rawTable = redis.call('GET', tableStateKey)
local hostUserId = userId
if rawTable == false or rawTable == '' then
    redis.call('SET', tableStateKey, initialTableJson)
else
    local ok, tbl = pcall(cjson.decode, rawTable)
    if ok and type(tbl) == 'table' then
        local currentHost = tbl.hostUserId
        local hostSeated = currentHost ~= nil and currentHost ~= cjson.null and currentHost ~= '' and seatedUsers[tostring(currentHost)]
        if not hostSeated then
            tbl.hostUserId = userId
            local encoded = cjson.encode(tbl)
            encoded = string.gsub(encoded, '"coHostUserIds":{}', '"coHostUserIds":[]')
            encoded = string.gsub(encoded, '"homeworkSlides":{}', '"homeworkSlides":[]')
            encoded = string.gsub(encoded, '"strokes":{}', '"strokes":[]')
            redis.call('SET', tableStateKey, encoded)
        else
            hostUserId = tostring(currentHost)
        end
    else
        redis.call('SET', tableStateKey, initialTableJson)
    end
end

return '1:' .. hostUserId
