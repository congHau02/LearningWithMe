package com.studytogether.modules.room;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms")
public class RoomTopologyController {

    private final RoomTopologyService roomTopologyService;

    public RoomTopologyController(RoomTopologyService roomTopologyService) {
        this.roomTopologyService = roomTopologyService;
    }

    @GetMapping("/{roomId}/topology")
    public RoomTopology getRoomTopology(@PathVariable String roomId) {
        return roomTopologyService.getRoomTopology(roomId);
    }

    @GetMapping("/{roomId}/seats/{seatId}")
    public SeatMetadata getSeatMetadata(
            @PathVariable String roomId,
            @PathVariable String seatId
    ) {
        return roomTopologyService.getSeat(roomId, seatId);
    }
}
