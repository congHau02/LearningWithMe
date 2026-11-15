package com.studytogether.modules.room;

public record ShardReservationOutcome(boolean reserved, long activeLearnerCount) {}
