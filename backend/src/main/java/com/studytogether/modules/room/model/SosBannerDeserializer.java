package com.studytogether.modules.room.model;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;

public class SosBannerDeserializer extends JsonDeserializer<String> {

    @Override
    public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        JsonToken token = parser.currentToken();
        if (token == JsonToken.VALUE_NULL) {
            return null;
        }
        if (token == JsonToken.VALUE_TRUE) {
            return "SOS";
        }
        if (token == JsonToken.VALUE_FALSE) {
            return null;
        }
        if (token == JsonToken.VALUE_STRING) {
            String value = parser.getValueAsString();
            return (value == null || value.isBlank()) ? null : value.trim();
        }
        parser.skipChildren();
        return null;
    }
}
