import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

interface FlightAttributes {
  flight_id: number;
  aircraft_id: number;
  flight_number: string;
  departure_airport_id: number;
  destination_airport_id: number;
  departure_time: Date;
  arrival_time: Date;
  price_economy: number;
  price_business: number;
  available_seats: number;
  status: 'scheduled' | 'delayed' | 'cancelled' | 'in_air' | 'landed';
}

interface FlightCreationAttributes extends Optional<FlightAttributes, 'flight_id'> { }

export class Flight extends Model<FlightAttributes, FlightCreationAttributes> implements FlightAttributes {
  public flight_id!: number;
  public aircraft_id!: number;
  public flight_number!: string;
  public departure_airport_id!: number;
  public destination_airport_id!: number;
  public departure_time!: Date;
  public arrival_time!: Date;
  public price_economy!: number;
  public price_business!: number;
  public available_seats!: number;
  public status!: 'scheduled' | 'delayed' | 'cancelled' | 'in_air' | 'landed';
}

export default (sequelize: Sequelize) => {
  Flight.init(
    {
      flight_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      aircraft_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      flight_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      departure_airport_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      destination_airport_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      departure_time: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      arrival_time: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      price_economy: {
        type: DataTypes.DECIMAL(10, 0),
        allowNull: false,
      },
      price_business: {
        type: DataTypes.DECIMAL(10, 0),
        allowNull: false,
      },
      available_seats: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'delayed', 'cancelled', 'in_air', 'landed'),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'flights',
      timestamps: false,
    }
  );

  return Flight;
};
