// Função utilitária para requisições autenticadas ao backend
function fetchComToken(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, options)
        .then(res => {
            if (res.status === 401) {
                // Token inválido ou expirado, redireciona para login
                window.location.href = 'login-firebase.html';
                throw new Error('Não autorizado');
            }
            return res;
        });
}
// data.js - Dados e funções de gerenciamento do Eventflow

const EventflowData = {
    // Dados de exemplo
    events: [
        {
            id: 1,
            title: "Conferência Tech 2024",
            description: "A maior conferência de tecnologia do ano, reunindo especialistas e inovadores da área.",
            date: "2024-10-15",
            time: "09:00",
            endDate: "2024-10-17",
            endTime: "18:00",
            location: "Centro de Convenções",
            address: "Av. Paulista, 1234 - São Paulo, SP",
            category: "Tecnologia",
            status: "upcoming",
            capacity: 500,
            registered: 250,
            organizer: "João Silva",
            color: "#1976d2",
            attendees: [1, 2, 3, 4, 5]
        },
        {
            id: 2,
            title: "Workshop Marketing Digital",
            description: "Workshop prático sobre estratégias de marketing digital para pequenas empresas.",
            date: "2024-10-10",
            time: "14:00",
            endDate: "2024-10-10",
            endTime: "18:00",
            location: "Sala de Reuniões A",
            address: "Rua Augusta, 567 - São Paulo, SP",
            category: "Marketing",
            status: "completed",
            capacity: 50,
            registered: 45,
            organizer: "Maria Santos",
            color: "#f57c00",
            attendees: [1, 2, 6, 7, 8]
        },
        {
            id: 3,
            title: "Treinamento de Liderança",
            description: "Desenvolvimento de habilidades de liderança para gestores e supervisores.",
            date: "2024-10-05",
            time: "08:30",
            endDate: "2024-10-06",
            endTime: "17:30",
            location: "Auditório Principal",
            address: "Av. Brigadeiro Faria Lima, 1000 - São Paulo, SP",
            category: "Desenvolvimento",
            status: "ongoing",
            capacity: 100,
            registered: 80,
            organizer: "Carlos Oliveira",
            color: "#388e3c",
            attendees: [1, 9, 10, 11, 12]
        },
        {
            id: 4,
            title: "Feira de Carreiras",
            description: "Feira de recrutamento com empresas de diversos setores.",
            date: "2024-11-20",
            time: "10:00",
            endDate: "2024-11-21",
            endTime: "17:00",
            location: "Centro de Exposições",
            address: "Av. das Nações Unidas, 500 - São Paulo, SP",
            category: "Recrutamento",
            status: "upcoming",
            capacity: 1000,
            registered: 320,
            organizer: "Ana Costa",
            color: "#7b1fa2",
            attendees: [1, 13, 14, 15, 16]
        }
    ],

    attendees: [
        { id: 1, name: "João Silva", email: "joao@email.com", phone: "(11) 99999-9999", company: "Tech Corp", role: "Administrador" },
        { id: 2, name: "Maria Santos", email: "maria@email.com", phone: "(11) 98888-8888", company: "Digital Solutions", role: "Palestrante" },
        { id: 3, name: "Carlos Oliveira", email: "carlos@email.com", phone: "(11) 97777-7777", company: "Innovation Labs", role: "Participante" },
        { id: 4, name: "Ana Costa", email: "ana@email.com", phone: "(11) 96666-6666", company: "Future Tech", role: "Organizador" },
        { id: 5, name: "Pedro Almeida", email: "pedro@email.com", phone: "(11) 95555-5555", company: "Startup Inc", role: "Participante" }
    ],

    notifications: [
        {
            id: 1,
            title: "Novo participante registrado",
            message: "João Silva se registrou para Conferência Tech 2024",
            time: "2024-10-10T10:30:00",
            type: "registration",
            read: false
        },
        {
            id: 2,
            title: "Evento atualizado",
            message: "Workshop Marketing Digital foi atualizado",
            time: "2024-10-09T14:20:00",
            type: "update",
            read: false
        },
        {
            id: 3,
            title: "Nova mensagem no chat",
            message: "Você tem uma nova mensagem no chat do evento Treinamento de Liderança",
            time: "2024-10-09T09:15:00",
            type: "message",
            read: false
        }
    ],

    user: {
        id: 1,
        name: "João Silva",
        email: "joao.silva@eventflow.com",
        role: "Administrador",
        avatar: null,
        phone: "(11) 99999-9999",
        department: "TI",
        bio: "Especialista em gestão de eventos corporativos.",
        joinedDate: "2023-01-15"
    },

    // Funções de gerenciamento
    getEvents: function(filter = 'all') {
        if (filter === 'all') return this.events;
        return this.events.filter(event => event.status === filter);
    },

    getEventById: function(id) {
        return this.events.find(event => event.id === id);
    },

    addEvent: function(event) {
        const newEvent = {
            id: this.events.length + 1,
            ...event,
            registered: 0,
            attendees: []
        };
        this.events.push(newEvent);
        return newEvent;
    },

    updateEvent: function(id, eventData) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1) {
            this.events[index] = { ...this.events[index], ...eventData };
            return this.events[index];
        }
        return null;
    },

    deleteEvent: function(id) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1) {
            return this.events.splice(index, 1)[0];
        }
        return null;
    },

    getAttendees: function() {
        return this.attendees;
    },

    addAttendee: function(attendee) {
        const newAttendee = {
            id: this.attendees.length + 1,
            ...attendee
        };
        this.attendees.push(newAttendee);
        return newAttendee;
    },

    getNotifications: function() {
        return this.notifications.filter(n => !n.read);
    },

    markNotificationAsRead: function(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
        }
    },

    getUser: function() {
        return this.user;
    },

    updateUser: function(userData) {
        Object.assign(this.user, userData);
        return this.user;
    },

    // Funções de busca
    searchEvents: function(query) {
        const searchLower = query.toLowerCase();
        return this.events.filter(event => 
            event.title.toLowerCase().includes(searchLower) ||
            event.description.toLowerCase().includes(searchLower) ||
            event.location.toLowerCase().includes(searchLower)
        );
    },

    searchAttendees: function(query) {
        const searchLower = query.toLowerCase();
        return this.attendees.filter(attendee =>
            attendee.name.toLowerCase().includes(searchLower) ||
            attendee.email.toLowerCase().includes(searchLower) ||
            attendee.company.toLowerCase().includes(searchLower)
        );
    },

    // Funções de filtro
    filterEvents: function(filters) {
        let events = [...this.events];

        if (filters.status && filters.status !== 'all') {
            events = events.filter(event => event.status === filters.status);
        }

        if (filters.category && filters.category !== 'all') {
            events = events.filter(event => event.category === filters.category);
        }

        if (filters.dateFrom) {
            events = events.filter(event => new Date(event.date) >= new Date(filters.dateFrom));
        }

        if (filters.dateTo) {
            events = events.filter(event => new Date(event.date) <= new Date(filters.dateTo));
        }

        return events;
    },

    // Estatísticas
    getStatistics: function() {
        const events = this.events;
        return {
            totalEvents: events.length,
            upcomingEvents: events.filter(e => e.status === 'upcoming').length,
            ongoingEvents: events.filter(e => e.status === 'ongoing').length,
            completedEvents: events.filter(e => e.status === 'completed').length,
            totalAttendees: events.reduce((sum, event) => sum + event.registered, 0),
            eventSuccessRate: Math.floor((events.filter(e => e.status === 'completed').length / events.length) * 100) || 0
        };
    },

    // Funções para calendário
    getEventsForCalendar: function() {
        return this.events.map(event => ({
            id: event.id,
            title: event.title,
            start: `${event.date}T${event.time}`,
            end: `${event.endDate}T${event.endTime}`,
            color: event.color,
            extendedProps: {
                location: event.location,
                status: event.status
            }
        }));
    }
};

// Exportar para uso global
window.EventflowData = EventflowData;

// Inicializar dados no localStorage se não existirem
if (!localStorage.getItem('eventflowData')) {
    localStorage.setItem('eventflowData', JSON.stringify(EventflowData));
}

// Função para carregar dados do localStorage
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('eventflowData');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        Object.assign(EventflowData, parsedData);
    }
}

// Função para salvar dados no localStorage
function saveToLocalStorage() {
    localStorage.setItem('eventflowData', JSON.stringify(EventflowData));
}

// Carregar dados do localStorage ao iniciar
loadFromLocalStorage();

// Salvar dados automaticamente antes da página ser descarregada
window.addEventListener('beforeunload', saveToLocalStorage);