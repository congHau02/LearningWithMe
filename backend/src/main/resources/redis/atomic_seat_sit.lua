-- Atomically locks a Seat in room:{roomId}:seats, enforces Table Lock inviteCode, and elects initial Table Host in table:{roomId}:{tableId}:state
-- KEYS[1]: room:{roomId}:seats
-- KEYS[2]: table:{roomId}:{tableId}:state
-- ARGV[1]: seatId
-- ARGV[2]: userId
-- ARGV[3]: initial RedisTableState JSON (with hostUserId = userId)
-- ARGV[4]: inviteCode (optional, empty string if omitted)
-- Return:
--   "1:<hostUserId>": successfully locked and resolved hostUserId
--   "0": seat is already occupied by someone else
--   "-1": user is already occupying a seat in this room
--   "-2": table is locked and inviteCode does not match

local seatsKey = KEYS[1]
local tableStateKey = KEYS[2]
local seatId = ARGV[1]
local userId = ARGV[2]
local initialTableJson = ARGV[3]
local inviteCode = ARGV[4] or ''

local allSeats = redis.call('HGETALL', seatsKey)
local seatedUsers = {}
for i = 1, #allSeats, 2 do
    local occupant = allSeats[i + 1]
    if occupant == userId then
        return '-1'
    end
    seatedUsers[occupant] = true
end

local rawTable = redis.call('GET', tableStateKey)
local parsedTable = nil
local hostSeated = false
if rawTable ~= false and rawTable ~= '' then
    local ok, tbl = pcall(cjson.decode, rawTable)
    if ok and type(tbl) == 'table' then
        parsedTable = tbl
        local currentHost = tbl.hostUserId
        hostSeated = currentHost ~= nil and currentHost ~= cjson.null and currentHost ~= '' and seatedUsers[tostring(currentHost)] == true
        if hostSeated and tbl.isTableLocked == true then
            local expectedCode = tbl.inviteCode
            if expectedCode == nil or expectedCode == cjson.null or expectedCode == '' or inviteCode ~= tostring(expectedCode) then
                return '-2'
            end
        end
    end
end

local setOk = redis.call('HSETNX', seatsKey, seatId, userId)
if setOk == 0 then
    return '0'
end

local hostUserId = userId
if parsedTable == nil then
    redis.call('SET', tableStateKey, initialTableJson)
elseif not hostSeated then
    parsedTable.hostUserId = userId
    parsedTable.isTableLocked = false
    parsedTable.inviteCode = cjson.null
    local encoded = cjson.encode(parsedTable)
    encoded = string.gsub(encoded, '"coHostUserIds":{}', '"coHostUserIds":[]')
    encoded = string.gsub(encoded, '"homeworkSlides":{}', '"homeworkSlides":[]')
    encoded = string.gsub(encoded, '"strokes":{}', '"strokes":[]')
    redis.call('SET', tableStateKey, encoded)
else
    hostUserId = tostring(parsedTable.hostUserId)
end

return '1:' .. hostUserId
