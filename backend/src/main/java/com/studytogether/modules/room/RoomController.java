package com.studytogether.modules.room;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RoomJoinRequest;
import com.studytogether.modules.room.model.RoomJoinResponse;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {

    private final RoomPresenceService roomPresenceService;

    public RoomController(RoomPresenceService roomPresenceService) {
        this.roomPresenceService = roomPresenceService;
    }

    @PostMapping(path = "/join", consumes = MediaType.APPLICATION_JSON_VALUE)
    public RoomJoinResponse joinRoomWithOptions(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody(required = false) RoomJoinRequest request
    ) {
        return roomPresenceService.joinShard(principal, request);
    }

    @PostMapping(path = "/join", consumes = "!" + MediaType.APPLICATION_JSON_VALUE)
    public RoomJoinResponse joinRoom(@AuthenticationPrincipal AuthPrincipal principal) {
        return roomPresenceService.joinShard(principal, null);
    }

    @GetMapping("/{roomId}/state")
    public RoomSnapshotResponse getRoomSnapshot(@PathVariable String roomId) {
        return roomPresenceService.getRoomSnapshot(roomId);
    }
}
