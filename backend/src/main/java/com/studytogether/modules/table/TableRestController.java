package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.table.model.TableWorkspaceSnapshot;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rooms/{roomId}/tables")
public class TableRestController {

    private final TableWorkspaceService workspaceService;

    public TableRestController(TableWorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    @GetMapping("/{tableId}/state")
    public TableWorkspaceSnapshot getTableWorkspaceState(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable String roomId,
            @PathVariable String tableId
    ) {
        return workspaceService.getWorkspaceSnapshot(principal, roomId, tableId);
    }
}
