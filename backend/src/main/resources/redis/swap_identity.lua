-- Atomically swap guestId -> registeredUserId across active Room and Table Redis keys (ADR-0004).
local guestId = ARGV[1]
local registeredUserId = ARGV[2]
local nickname = ARGV[3]
local avatarId = ARGV[4]
local swappedCount = 0

local function startsWith(str, prefix)
    return string.sub(str, 1, #prefix) == prefix
end

local function endsWith(str, suffix)
    return #str >= #suffix and string.sub(str, -#suffix) == suffix
end

for _, key in ipairs(KEYS) do
    if startsWith(key, "room:") and endsWith(key, ":players") then
        local raw = redis.call("HGET", key, guestId)
        if raw ~= false then
            local updated = raw
            local ok, obj = pcall(cjson.decode, raw)
            if ok and type(obj) == "table" then
                if obj.userId ~= nil then
                    obj.userId = registeredUserId
                end
                if nickname ~= "" and obj.nickname ~= nil then
                    obj.nickname = nickname
                end
                if avatarId ~= "" and obj.avatarId ~= nil then
                    obj.avatarId = avatarId
                end
                updated = cjson.encode(obj)
            end
            redis.call("HDEL", key, guestId)
            redis.call("HSET", key, registeredUserId, updated)
            swappedCount = swappedCount + 1
        end
    elseif startsWith(key, "room:") and endsWith(key, ":seats") then
        local entries = redis.call("HGETALL", key)
        for i = 1, #entries, 2 do
            if entries[i + 1] == guestId then
                redis.call("HSET", key, entries[i], registeredUserId)
                swappedCount = swappedCount + 1
            end
        end
    elseif startsWith(key, "room:") and endsWith(key, ":disconnects") then
        local disconnectedAt = redis.call("HGET", key, guestId)
        if disconnectedAt ~= false then
            redis.call("HDEL", key, guestId)
            redis.call("HSET", key, registeredUserId, disconnectedAt)
            swappedCount = swappedCount + 1
        end
    elseif startsWith(key, "table:") and endsWith(key, ":state") then
        local raw = redis.call("GET", key)
        if raw ~= false then
            local ok, state = pcall(cjson.decode, raw)
            if ok and type(state) == "table" then
                local changed = false
                if state.hostUserId == guestId then
                    state.hostUserId = registeredUserId
                    changed = true
                end

                if type(state.coHostUserIds) == "table" then
                    local nextCoHosts = {}
                    local seen = {}
                    local coHostChanged = false
                    for _, cid in ipairs(state.coHostUserIds) do
                        local mapped = cid
                        if cid == guestId then
                            mapped = registeredUserId
                            coHostChanged = true
                        end
                        if mapped ~= state.hostUserId and not seen[mapped] then
                            seen[mapped] = true
                            table.insert(nextCoHosts, mapped)
                        else
                            coHostChanged = true
                        end
                    end
                    if coHostChanged then
                        state.coHostUserIds = nextCoHosts
                        changed = true
                    end
                end

                if type(state.homeworkSlides) == "table" then
                    for _, slide in ipairs(state.homeworkSlides) do
                        if type(slide) == "table" then
                            if slide.uploadedByUserId == guestId then
                                slide.uploadedByUserId = registeredUserId
                                changed = true
                            elseif slide.uploadedBy == guestId then
                                slide.uploadedBy = registeredUserId
                                changed = true
                            end
                        end
                    end
                end

                if changed then
                    local encoded = cjson.encode(state)
                    encoded = string.gsub(encoded, '"coHostUserIds":{}', '"coHostUserIds":[]')
                    encoded = string.gsub(encoded, '"homeworkSlides":{}', '"homeworkSlides":[]')
                    encoded = string.gsub(encoded, '"strokes":{}', '"strokes":[]')
                    redis.call("SET", key, encoded, "KEEPTTL")
                    swappedCount = swappedCount + 1
                end
            end
        end
    end
end

return swappedCount
