-- Atomic sliding-window rate limiter using a Redis ZSET timestamp log.
-- KEYS[1]: rate-limit ZSET key
-- ARGV[1]: nowEpochMs
-- ARGV[2]: windowMs
-- ARGV[3]: maxRequests
-- ARGV[4]: unique member id
-- ARGV[5]: ttlMs
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local member = ARGV[4]
local ttlMs = tonumber(ARGV[5])

local windowStart = now - windowMs
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
local currentCount = redis.call('ZCARD', key)
if currentCount >= maxRequests then
    return 0
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, ttlMs)
return 1
