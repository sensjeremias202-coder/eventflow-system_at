// Sistema de autenticação com Firebase
window.firebaseAuth = {
    // Registrar usuário
    async register(email, password, name) {
        try {
            // Criar usuário
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Salvar informações adicionais no Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                email: email,
                role: 'usuário',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                eventsCount: 0,
                participantsCount: 0,
                successRate: 0
            });
            
            return { success: true, user: user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Login
    async login(email, password) {
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Logout
    async logout() {
        await firebase.auth().signOut();
    },
    
    // Verificar se está logado
    isLoggedIn() {
        return firebase.auth().currentUser !== null;
    },
    
    // Obter usuário atual
    getCurrentUser() {
        return firebase.auth().currentUser;
    },
    
    // Obter dados do perfil
    async getUserProfile() {
        const user = this.getCurrentUser();
        if (!user) return null;
        
        const doc = await db.collection('users').doc(user.uid).get();
        return doc.exists ? doc.data() : null;
    },
    
    // Atualizar perfil
    async updateProfile(data) {
        const user = this.getCurrentUser();
        if (!user) return { success: false, error: 'Não autenticado' };
        
        try {
            await db.collection('users').doc(user.uid).update(data);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Alterar senha
    async changePassword(newPassword) {
        const user = this.getCurrentUser();
        if (!user) return { success: false, error: 'Não autenticado' };
        
        try {
            await user.updatePassword(newPassword);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Monitorar estado de autenticação
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('Usuário logado:', user.email);
    } else {
        console.log('Usuário deslogado');
    }
});