// In-memory data store for demo mode
let users = [];
let barbers = [];
let reservations = [];

// Demo data store functions
export const demoData = {
  // Users
  findUserByEmail: (email) => {
    return users.find(user => user.email === email);
  },
  
  createUser: (userData) => {
    const newUser = {
      id: `user-${Date.now()}`,
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(newUser);
    return newUser;
  },
  
  // Barbers
  createBarber: (barberData) => {
    const newBarber = {
      id: `barber-${Date.now()}`,
      ...barberData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    barbers.push(newBarber);
    return newBarber;
  },
  
  getBarbers: () => {
    return barbers.map(barber => ({
      ...barber,
      fullName: users.find(u => u.id === barber.userId)?.fullName || 'Unknown',
      email: users.find(u => u.id === barber.userId)?.email || 'unknown@email.com',
      phone: users.find(u => u.id === barber.userId)?.phone || 'Unknown'
    }));
  },
  
  // Reservations
  createReservation: (reservationData) => {
    const newReservation = {
      id: `reservation-${Date.now()}`,
      ...reservationData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    reservations.push(newReservation);
    return newReservation;
  },
  
  getReservationsByBarber: (barberId, date) => {
    return reservations
      .filter(r => r.barberId === barberId && (!date || r.date === date))
      .map(reservation => ({
        ...reservation,
        clientName: users.find(u => u.id === reservation.clientId)?.fullName || 'Unknown',
        clientPhone: users.find(u => u.id === reservation.clientId)?.phone || 'Unknown',
        clientEmail: users.find(u => u.id === reservation.clientId)?.email || 'Unknown'
      }));
  },
  
  getReservationsByClient: (clientId) => {
    return reservations
      .filter(r => r.clientId === clientId)
      .map(reservation => ({
        ...reservation,
        barberName: users.find(u => u.id === barbers.find(b => b.id === reservation.barberId)?.userId)?.fullName || 'Unknown',
        barberPhone: users.find(u => u.id === barbers.find(b => b.id === reservation.barberId)?.userId)?.phone || 'Unknown',
        barberLocation: barbers.find(b => b.id === reservation.barberId)?.manualLocation || 'Unknown'
      }));
  },
  
  deleteReservation: (reservationId) => {
    const index = reservations.findIndex(r => r.id === reservationId);
    if (index > -1) {
      reservations.splice(index, 1);
      return true;
    }
    return false;
  }
}; 