package com.studytogether.modules.stats;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterItemRepository extends JpaRepository<CharacterItemEntity, String> {
    List<CharacterItemEntity> findByItemTypeOrderByRequiredStudyMinutesAsc(CharacterItemType itemType);
}
