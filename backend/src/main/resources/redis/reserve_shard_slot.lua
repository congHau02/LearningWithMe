-- Atomically checks shard capacity (players + non-expired reservations) and reserves a slot for userId
-- KEYS[1]: room:{roomId}:players
-- KEYS[2]: room:{roomId}:seats
-- KEYS[3]: room:{roomId}:reservations
-- KEYS[4]: rooms:shards
-- ARGV[1]: userId
-- ARGV[2]: capacity
-- ARGV[3]: nowEpochMs
-- ARGV[4]: expiresAtEpochMs
-- ARGV[5]: roomId
-- Return:
--   "1:<activeCount>": slot reserved (or user already present in shard)
--   "0:<activeCount>": shard is at capacity

local playersKey = KEYS[1]
local seatsKey = KEYS[2]
local reservationsKey = KEYS[3]
local shardsKey = KEYS[4]
local userId = ARGV[1]
local capacity = tonumber(ARGV[2]) or 50
local nowMs = tonumber(ARGV[3]) or 0
local expiresAtMs = tonumber(ARGV[4]) or 0
local roomId = ARGV[5]

local resEntries = redis.call('HGETALL', reservationsKey)
local validResUsers = {}
local userHasValidRes = false
for i = 1, #resEntries, 2 do
    local rUser = resEntries[i]
    local exp = tonumber(resEntries[i + 1]) or 0
    if exp <= nowMs then
        redis.call('HDEL', reservationsKey, rUser)
    else
        validResUsers[rUser] = true
        if rUser == userId then
            userHasValidRes = true
        end
    end
end

local playerKeys = redis.call('HKEYS', playersKey)
local activeCount = #playerKeys
for rUser, _ in pairs(validResUsers) do
    if redis.call('HEXISTS', playersKey, rUser) == 0 then
        activeCount = activeCount + 1
    end
end

if redis.call('HEXISTS', playersKey, userId) == 1 then
    redis.call('HDEL', reservationsKey, userId)
    return '1:' .. tostring(activeCount)
end

local seatOccupants = redis.call('HVALS', seatsKey)
for i = 1, #seatOccupants do
    if seatOccupants[i] == userId then
        redis.call('SADD', shardsKey, roomId)
        return '1:' .. tostring(activeCount)
    end
end

if userHasValidRes then
    redis.call('HSET', reservationsKey, userId, tostring(expiresAtMs))
    redis.call('SADD', shardsKey, roomId)
    return '1:' .. tostring(activeCount)
end

if activeCount < capacity then
    redis.call('HSET', reservationsKey, userId, tostring(expiresAtMs))
    redis.call('SADD', shardsKey, roomId)
    return '1:' .. tostring(activeCount + 1)
end

return '0:' .. tostring(activeCount)
