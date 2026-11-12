package com.studytogether.modules.stats;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "character_items")
public class CharacterItemEntity {

    @Id
    @Column(name = "id", length = 50, nullable = false)
    private String id;

    @Column(name = "item_name", length = 100, nullable = false)
    private String itemName;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, columnDefinition = "ENUM('SKIN', 'HAT', 'DESK_PET')")
    private CharacterItemType itemType;

    @Column(name = "required_study_minutes", nullable = false)
    private int requiredStudyMinutes;

    protected CharacterItemEntity() {}

    public CharacterItemEntity(String id, String itemName, CharacterItemType itemType, int requiredStudyMinutes) {
        this.id = id;
        this.itemName = itemName;
        this.itemType = itemType;
        this.requiredStudyMinutes = requiredStudyMinutes;
    }

    public String getId() { return id; }
    public String getItemName() { return itemName; }
    public CharacterItemType getItemType() { return itemType; }
    public int getRequiredStudyMinutes() { return requiredStudyMinutes; }
}
