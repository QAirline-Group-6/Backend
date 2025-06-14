import { Request, Response } from 'express';
import db from '../models';
import { Sequelize, Op } from 'sequelize';

const Flight = db.Flight;

export const getAllFlights = async (req: Request, res: Response): Promise<void> => {
  try {
    const flights = await Flight.findAll({
      include: [
        { model: db.Airport, as: 'departureAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Airport, as: 'destinationAirport', attributes: ['airport_id', 'name', 'code'] }
      ]
    });
    res.json(flights);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getPopularFlights = async (req: Request, res: Response): Promise<void> => {
  try {
    const flights = await Flight.findAll({
      include: [
        { model: db.Airport, as: 'departureAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Airport, as: 'destinationAirport', attributes: ['airport_id', 'name', 'code'] }
      ],
      order: [['bookings', 'DESC']],
      limit: 5
    });
    res.json(flights);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getFlightById = async (req: Request, res: Response): Promise<void> => {
  try {
    const flight = await Flight.findByPk(req.params.id);
    if (!flight) {
      res.status(404).json({ message: 'Không tìm thấy chuyến bay.' });
      return;
    }
    res.json(flight);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createFlight = async (req: Request, res: Response): Promise<void> => {
  try {
    const flight = await Flight.create(req.body);
    res.status(201).json(flight);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const updateFlight = async (req: Request, res: Response): Promise<void> => {
  try {
    const flight = await Flight.findByPk(req.params.id);
    if (!flight) {
      res.status(404).json({ message: 'Không tìm thấy chuyến bay.' });
      return;
    }

    await flight.update(req.body);
    res.json(flight);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteFlight = async (req: Request, res: Response): Promise<void> => {
  try {
    const flight = await Flight.findByPk(req.params.id);
    if (!flight) {
      res.status(404).json({ message: 'Không tìm thấy chuyến bay.' });
      return;
    }

    await flight.destroy();
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const searchFlightsByDes = async (req: Request, res: Response): Promise<void> => {
  try {
    const fromAirport = decodeURIComponent(req.query.fromAirport as string);
    const toAirport = decodeURIComponent(req.query.toAirport as string);
    const departureDate = decodeURIComponent(req.query.departureDate as string);
    const tripType = req.query.tripType as string;
    const passengerCount = parseInt(req.query.passengerCount as string) || 1;
    const returnDate = req.query.returnDate ? decodeURIComponent(req.query.returnDate as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 3;
    const offset = (page - 1) * limit;

    // Get filter parameters
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const timeOfDay = req.query.timeOfDay as string;

    // Validate required parameters
    if (!fromAirport || !toAirport || !departureDate) {
      res.status(400).json({
        success: false,
        message: 'Thiếu thông tin điểm đi, điểm đến hoặc ngày đi',
        required: 'fromAirport, toAirport, departureDate (format: YYYY-MM-DD)'
      });
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    if (!dateRegex.test(departureDate)) {
      res.status(400).json({
        success: false,
        message: 'Định dạng ngày không hợp lệ. Sử dụng YYYY-MM-DD',
        example: '2025-06-11'
      });
      return;
    }

    // Find airports by their codes
    const fromAirportData = await db.Airport.findOne({ where: { code: fromAirport } });
    const toAirportData = await db.Airport.findOne({ where: { code: toAirport } });

    if (!fromAirportData || !toAirportData) {
      res.status(400).json({
        success: false,
        message: 'Không tìm thấy sân bay'
      });
      return;
    }

    // Create date range for the entire day (Vietnam timezone)
    const vietnamDate = new Date(departureDate);
    vietnamDate.setHours(vietnamDate.getHours() + 7); // Convert to Vietnam timezone
    const startDateTime = `${vietnamDate.toISOString().split('T')[0]} 00:00:00`;
    const endDateTime = `${vietnamDate.toISOString().split('T')[0]} 23:59:59`;

    // Base where conditions
    let whereConditions: any = {
      departure_airport_id: fromAirportData.airport_id,
      destination_airport_id: toAirportData.airport_id,
      departure_time: {
        [Op.between]: [startDateTime, endDateTime]
      },
      status: 'scheduled',
      available_seats: {
        [Op.gte]: passengerCount
      }
    };

    // Add price filters if they exist
    if (minPrice !== undefined || maxPrice !== undefined) {
      whereConditions.price_economy = {};
      if (minPrice !== undefined) {
        whereConditions.price_economy[Op.gte] = minPrice;
      }
      if (maxPrice !== undefined) {
        whereConditions.price_economy[Op.lte] = maxPrice;
      }
    }

    // Add time of day filter if it exists (Vietnam timezone)
    if (timeOfDay) {
      const timeRanges: { [key: string]: { start: string; end: string } } = {
        morning: { start: '00:00:00', end: '11:59:59' },
        afternoon: { start: '12:00:00', end: '17:59:59' },
        evening: { start: '18:00:00', end: '23:59:59' }
      };

      if (timeRanges[timeOfDay]) {
        const { start, end } = timeRanges[timeOfDay];
        whereConditions.departure_time = {
          [Op.and]: [
            { [Op.between]: [startDateTime, endDateTime] },
            Sequelize.where(
              Sequelize.fn('TIME', Sequelize.fn('CONVERT_TZ', Sequelize.col('departure_time'), '+00:00', '+07:00')),
              { [Op.between]: [start, end] }
            )
          ]
        };
      }
    }

    // Get total count of matching flights
    const total = await Flight.count({ where: whereConditions });

    // Get paginated flights
    const flights = await Flight.findAll({
      include: [
        { model: db.Airport, as: 'departureAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Airport, as: 'destinationAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Aircraft, as: 'aircraft', attributes: ['manufacturer', 'model'] }
      ],
      where: whereConditions,
      order: [['departure_time', 'ASC']],
      limit: limit,
      offset: offset
    });

    // Helper function to calculate flight duration
    const calculateDuration = (departureTime: string, arrivalTime: string): string => {
      const departure = new Date(departureTime);
      const arrival = new Date(arrivalTime);
      const diffMs = arrival.getTime() - departure.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${diffHrs}h ${diffMins}m`;
    };

    // Helper function to determine airline based on flight number
    const getAirlineFromFlightNumber = (flightNumber: string): string => {
      const airlineCodes: { [key: string]: string } = {
        'VN': 'Vietnam Airlines',
        'QH': 'Bamboo Airways',
        'VJ': 'Vietjet Air',
        'BL': 'Pacific Airlines',
        'TG': 'Thai Airways International'
      };

      const code = flightNumber.substring(0, 2);
      return airlineCodes[code] || 'Unknown Airline';
    };

    res.status(200).json({
      success: true,
      flights: flights.map(flight => {
        const flightData = flight.toJSON() as any;
        return {
          ...flightData,
          departure_date: new Date(flightData.departure_time).toISOString().split('T')[0],
          aircraft_type: `${flightData.aircraft.manufacturer} ${flightData.aircraft.model}`,
          airline: getAirlineFromFlightNumber(flightData.flight_number)
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      searchCriteria: {
        fromAirport: fromAirportData.airport_id,
        toAirport: toAirportData.airport_id,
        departureDate: departureDate.split('T')[0],
        tripType,
        passengerCount,
        returnDate,
        filters: {
          minPrice,
          maxPrice,
          timeOfDay
        }
      }
    });

  } catch (error: any) {
    console.error('Error searching flights:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to calculate flight duration
const calculateDuration = (departureTime: string, arrivalTime: string): string => {
  const departure = new Date(departureTime);
  const arrival = new Date(arrivalTime);
  const diffMs = arrival.getTime() - departure.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHrs}h ${diffMins}m`;
};

// Alternative method using Sequelize's date functions
export const searchFlightsByDesAlternative = async (req: Request, res: Response): Promise<void> => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const departureDate = req.query.departureDate as string;

    if (!from || !to || !departureDate) {
      res.status(400).json({ message: 'Thiếu thông tin cần thiết' });
      return;
    }

    // Sử dụng Sequelize.fn để so sánh chỉ phần DATE
    const flights = await Flight.findAll({
      include: [
        { model: db.Airport, as: 'departureAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Airport, as: 'destinationAirport', attributes: ['airport_id', 'name', 'code'] }
      ],
      where: {
        departure_airport_id: parseInt(from),
        destination_airport_id: parseInt(to),
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn('DATE', Sequelize.col('departure_time')),
            departureDate
          )
        ],
        status: 'scheduled'
      },
      order: [['departure_time', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: flights.length,
      flights: flights
    });

  } catch (error: any) {
    console.error('Error searching flights (alternative):', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

export const searchFlightsByPrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 3;
    const offset = (page - 1) * limit;

    if ((minPrice && isNaN(minPrice)) || (maxPrice && isNaN(maxPrice))) {
      res.status(400).json({ message: 'Giá trị không hợp lệ' });
      return;
    }

    const whereClause: any = {
      status: 'scheduled'
    };

    if (minPrice !== undefined && maxPrice !== undefined) {
      whereClause.price_economy = { [Op.between]: [minPrice, maxPrice] };
    } else if (minPrice !== undefined) {
      whereClause.price_economy = { [Op.gte]: minPrice };
    } else if (maxPrice !== undefined) {
      whereClause.price_economy = { [Op.lte]: maxPrice };
    }

    // Get total count of matching flights
    const total = await Flight.count({ where: whereClause });

    // Get paginated flights
    const flights = await Flight.findAll({
      include: [
        { model: db.Airport, as: 'departureAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Airport, as: 'destinationAirport', attributes: ['airport_id', 'name', 'code'] }
      ],
      where: whereClause,
      order: [['price_economy', 'ASC']],
      limit: limit,
      offset: offset
    });

    res.status(200).json({
      success: true,
      flights: flights,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      priceRange: {
        min: minPrice,
        max: maxPrice
      }
    });
  } catch (error: any) {
    console.error('Lỗi tìm chuyến bay theo giá:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

export const getPaginatedFlights = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 3;
    const offset = (page - 1) * limit;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const timeOfDay = req.query.timeOfDay as string | undefined;

    // Build where conditions
    const whereConditions: any = {};

    // Add price filters
    if (minPrice !== undefined || maxPrice !== undefined) {
      whereConditions.price_economy = {};
      if (minPrice !== undefined) {
        whereConditions.price_economy[Op.gte] = minPrice;
      }
      if (maxPrice !== undefined) {
        whereConditions.price_economy[Op.lte] = maxPrice;
      }
    }

    // Add time of day filter if it exists (Vietnam timezone)
    if (timeOfDay) {
      const timeRanges: { [key: string]: { start: string; end: string } } = {
        morning: { start: '00:00:00', end: '11:59:59' },
        afternoon: { start: '12:00:00', end: '17:59:59' },
        evening: { start: '18:00:00', end: '23:59:59' }
      };

      if (timeRanges[timeOfDay]) {
        const { start, end } = timeRanges[timeOfDay];
        whereConditions.departure_time = Sequelize.where(
          Sequelize.fn('TIME', Sequelize.fn('CONVERT_TZ', Sequelize.col('departure_time'), '+00:00', '+07:00')),
          { [Op.between]: [start, end] }
        );
      }
    }

    // Get total count of flights with filters
    const total = await Flight.count({ where: whereConditions });

    // Get paginated flights with airport information and filters
    const flights = await Flight.findAll({
      include: [
        { model: db.Airport, as: 'departureAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Airport, as: 'destinationAirport', attributes: ['airport_id', 'name', 'code'] },
        { model: db.Aircraft, as: 'aircraft', attributes: ['manufacturer', 'model'] }
      ],
      where: whereConditions,
      limit: limit,
      offset: offset,
      order: [['departure_time', 'DESC']],
      attributes: [
        'flight_id',
        'aircraft_id',
        'flight_number',
        'departure_airport_id',
        'destination_airport_id',
        'departure_time',
        'arrival_time',
        'price_economy',
        'price_business',
        'available_seats',
        'status'
      ]
    });

    // Helper function to determine airline based on flight number
    const getAirlineFromFlightNumber = (flightNumber: string): string => {
      const airlineCodes: { [key: string]: string } = {
        'VN': 'Vietnam Airlines',
        'QH': 'Bamboo Airways',
        'VJ': 'Vietjet Air',
        'BL': 'Pacific Airlines',
        'TG': 'Thai Airways International'
      };

      const code = flightNumber.substring(0, 2);
      return airlineCodes[code] || 'Unknown Airline';
    };

    // Format response to match the requested structure
    const formattedFlights = flights.map((flight: any) => {
      const flightData = flight.toJSON();
      return {
        flight_id: flightData.flight_id,
        aircraft_id: flightData.aircraft_id,
        flight_number: flightData.flight_number,
        departure_airport_id: flightData.departure_airport_id,
        destination_airport_id: flightData.destination_airport_id,
        departure_time: flightData.departure_time,
        arrival_time: flightData.arrival_time,
        price_economy: flightData.price_economy,
        price_business: flightData.price_business,
        available_seats: flightData.available_seats,
        status: flightData.status,
        departure_date: new Date(flightData.departure_time).toISOString().split('T')[0],
        aircraft_type: `${flightData.aircraft.manufacturer} ${flightData.aircraft.model}`,
        airline: getAirlineFromFlightNumber(flightData.flight_number),
        departureAirport: {
          airport_id: flightData.departureAirport.airport_id,
          name: flightData.departureAirport.name,
          code: flightData.departureAirport.code
        },
        destinationAirport: {
          airport_id: flightData.destinationAirport.airport_id,
          name: flightData.destinationAirport.name,
          code: flightData.destinationAirport.code
        }
      };
    });

    res.status(200).json({
      success: true,
      flights: formattedFlights,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        minPrice,
        maxPrice,
        timeOfDay
      }
    });

  } catch (error: any) {
    console.error('Error fetching paginated flights:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};