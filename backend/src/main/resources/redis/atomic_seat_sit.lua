-- Atomically locks a Seat in room:{roomId}:seats
-- KEYS[1]: room:{roomId}:seats
-- ARGV[1]: seatId
-- ARGV[2]: userId
-- Return:
--   1: successfully locked
--   0: seat is already occupied by someone else
--  -1: user is already occupying a seat in this room

local seatsKey = KEYS[1]
local seatId = ARGV[1]
local userId = ARGV[2]

local allSeats = redis.call('HGETALL', seatsKey)
for i = 1, #allSeats, 2 do
    if allSeats[i + 1] == userId then
        return -1
    end
end

local setOk = redis.call('HSETNX', seatsKey, seatId, userId)
if setOk == 1 then
    return 1
else
    return 0
end
