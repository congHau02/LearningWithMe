package com.studytogether.modules.table;

import com.studytogether.modules.auth.AuthPrincipal;
import com.studytogether.modules.table.model.VoiceIceServersResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/voice")
public class VoiceIceController {

    private final VoiceIceServerService voiceIceServerService;

    public VoiceIceController(VoiceIceServerService voiceIceServerService) {
        this.voiceIceServerService = voiceIceServerService;
    }

    @GetMapping("/ice-servers")
    public VoiceIceServersResponse getIceServers(@AuthenticationPrincipal AuthPrincipal principal) {
        return voiceIceServerService.issueIceServers(principal);
    }
}
