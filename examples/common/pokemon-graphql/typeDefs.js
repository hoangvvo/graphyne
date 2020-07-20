module.exports = `
  type Query {
    pokemon(name: String, id: ID): Pokemon
  }

  type Pokemon {
    id: ID!
    name: String!
    # order
    abilities: [AbilityWrapper!]
    base_experience: Int
    forms: [Form!]
    # game_indices: [GameIndice!]
    height: Int
    held_items: [ItemWrapper!]
    location_area_encounters: String
    moves: [MoveWrapper!]
    # species
    sprites: Sprite
    stats: [StatWrapper!]
    types: [TypeWrapper!]
    weight: Int
  }

  type Form {
    name: String!
    url: String!
  }

  type AbilityWrapper {
    ability: Ability!
    is_hidden: Boolean!
    slot: Int!
  }
  
  type Ability {
    name: String!
    url: String!
  }

  type ItemWrapper {
    item: Item!
    # version_details
  }

  type Item {
    name: String!
    url: String!
  }

  type MoveWrapper {
    move: Move!
    # version_group_details
  }

  type Move {
    name: String!
    url: String!
  }

  type Sprite {
    back_default: String!
    back_female: String
    back_shiny: String
    back_shiny_female: String
    front_default: String!
    front_female: String
    front_shiny: String
    front_shiny_female: String
  }

  type StatWrapper {
    base_stat: Int!
    effort: Int!
    stat: Stat!
  }

  type Stat {
    name: String!
    url: String!
  }

  type TypeWrapper {
    slot: Int!
    type: Type!
  }

  type Type {
    name: String!
    url: String!
  }
`;
