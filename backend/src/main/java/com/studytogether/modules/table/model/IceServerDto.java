package com.studytogether.modules.table.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record IceServerDto(
        List<String> urls,
        String username,
        String credential
) {
    public static IceServerDto stun(String url) {
        return new IceServerDto(List.of(url), null, null);
    }
}
