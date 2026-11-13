package com.studytogether.modules.room;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.room.model.RoomJoinResponse;
import com.studytogether.modules.room.model.RoomSnapshotResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms")
public class RoomController {

    private final RoomPresenceService roomPresenceService;

    public RoomController(RoomPresenceService roomPresenceService) {
        this.roomPresenceService = roomPresenceService;
    }

    @PostMapping("/join")
    public RoomJoinResponse joinRoom(@AuthenticationPrincipal AuthPrincipal principal) {
        return roomPresenceService.joinShard(principal);
    }

    @GetMapping("/{roomId}/state")
    public RoomSnapshotResponse getRoomSnapshot(@PathVariable String roomId) {
        return roomPresenceService.getRoomSnapshot(roomId);
    }
}
