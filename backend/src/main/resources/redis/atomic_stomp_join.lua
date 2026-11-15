-- Atomically joins a player into room:{roomId}:players respecting shard capacity and reservations
-- KEYS[1]: room:{roomId}:players
-- KEYS[2]: room:{roomId}:reservations
-- KEYS[3]: rooms:shards
-- ARGV[1]: userId
-- ARGV[2]: playerJson
-- ARGV[3]: capacity
-- ARGV[4]: nowEpochMs
-- ARGV[5]: roomId
-- Return:
--   1: joined/updated in players
--   0: rejected because shard is at capacity

local playersKey = KEYS[1]
local reservationsKey = KEYS[2]
local shardsKey = KEYS[3]
local userId = ARGV[1]
local playerJson = ARGV[2]
local capacity = tonumber(ARGV[3]) or 50
local nowMs = tonumber(ARGV[4]) or 0
local roomId = ARGV[5]

if redis.call('HEXISTS', playersKey, userId) == 1 then
    redis.call('HDEL', reservationsKey, userId)
    redis.call('HSET', playersKey, userId, playerJson)
    redis.call('SADD', shardsKey, roomId)
    return 1
end

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

if userHasValidRes then
    redis.call('HDEL', reservationsKey, userId)
    redis.call('HSET', playersKey, userId, playerJson)
    redis.call('SADD', shardsKey, roomId)
    return 1
end

local playerKeys = redis.call('HKEYS', playersKey)
local activeCount = #playerKeys
for rUser, _ in pairs(validResUsers) do
    if redis.call('HEXISTS', playersKey, rUser) == 0 then
        activeCount = activeCount + 1
    end
end

if activeCount < capacity then
    redis.call('HSET', playersKey, userId, playerJson)
    redis.call('SADD', shardsKey, roomId)
    return 1
end

return 0
