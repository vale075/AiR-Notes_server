class NoteService {
    constructor(baseUrl = '/api/notes') {
        this.baseUrl = baseUrl;
    }

    // Helper to retrieve the standard Django CSRF token from cookies
    _getCsrfToken() {
        const name = 'csrftoken';
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return '';
    }

    // Standard request headers for Session Auth + JSON payloads
    _getHeaders(isMultipart = false) {
        const headers = {
            'X-CSRFToken': this._getCsrfToken(),
        };
        if (!isMultipart) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    }

    /**
     * Fetch all notes assigned to a specific QR Code UUID
     * Maps to: GET /api/notes/qrcode/{qr_id}/notes
     */
    async getNotesForQRCode(qrId) {
        try {
            const response = await fetch(`${this.baseUrl}/qrcode/${qrId}/notes`);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
            return await response.json(); // Returns an array of notes
        } catch (error) {
            console.error(`Error fetching notes for QR ${qrId}:`, error);
            throw error;
        }
    }

    /**
     * Create a Text Note
     * Maps to: POST /api/notes/notes/text
     * payload format: { qrcode_id, content, title, pos_x, pos_y, pos_z, ... }
     */
    async createTextNote(payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/text`, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to create text note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error creating text note:", error);
            throw error;
        }
    }

    /**
     * Update an existing Text Note
     * Maps to: PUT /api/notes/notes/text/{note_id}
     */
    async updateTextNote(noteId, payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/text/${noteId}`, {
                method: 'PUT',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to update text note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error updating text note ${noteId}:`, error);
            throw error;
        }
    }

    /**
     * Create an Image Note (Uses Multipart/Form-Data)
     * Maps to: POST /api/notes/notes/image
     * Expects a native File object and the metadata payload object
     */
    async createImageNote(file, payload) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('payload', JSON.stringify(payload));

            const response = await fetch(`${this.baseUrl}/notes/image`, {
                method: 'POST',
                headers: this._getHeaders(true), // omit Content-Type so browser sets boundary
                body: formData
            });
            if (!response.ok) throw new Error(`Failed to create image note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error creating image note:", error);
            throw error;
        }
    }

    /**
     * Create an Arrow Note
     * Maps to: POST /api/notes/notes/arrow
     * payload format: { qrcode_id, content, title, pos_x, pos_y, pos_z, ... }
     */
    async createArrowtNote(payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/arrow`, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to create arrow note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("Error creating arrow note:", error);
            throw error;
        }
    }

    /**
     * Update an existing Arrow Note
     * Maps to: PUT /api/notes/notes/Arrow/{note_id}
     */
    async updateArrowNote(noteId, payload) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/arrow/${noteId}`, {
                method: 'PUT',
                headers: this._getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Failed to update arrow note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error updating arrow note ${noteId}:`, error);
            throw error;
        }
    }

    /**
     * Delete any note by ID
     * Maps to: DELETE /api/notes/notes/{note_id}
     */
    async deleteNote(noteId) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/${noteId}`, {
                method: 'DELETE',
                headers: this._getHeaders()
            });
            if (!response.ok) throw new Error(`Failed to delete note: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Error deleting note ${noteId}:`, error);
            throw error;
        }
    }
}

// Global instantiation
const noteService = new NoteService();

AFRAME.registerComponent('qr-space-controller', {
    schema: {
        qrid: { type: 'string' }
    },

    init: function () {
        this.currentQrId = this.data.qrid;
        if (!this.currentQrId) {
            console.error("No QRCode id was passed !");
            throw error;
        }
        else {
            this.loadSceneNotes();
        }
    },

    // Automatically fetches and maps notes into 3D Space
    loadSceneNotes: async function () {
        try {
            const notes = await noteService.getNotesForQRCode(this.currentQrId);
            for (const note of notes) {
                switch (note.note_type) {
                    case 'TXT': {
                        const el = document.createElement('a-entity');
                        el.setAttribute('txtnote', note);
                        this.el.appendChild(el);
                        break;
                    }
                    case 'IMA': {
                        const el = document.createElement('a-image');
                        el.setAttribute('imgnote', note);
                        this.el.appendChild(el);
                        break;
                    }
                    case 'ARR': {
                        const el = document.createElement('a-entity');
                        el.setAttribute('arrnote', note);
                        this.el.appendChild(el);
                        break;
                    }
                    default:
                        console.error("Undefined note type: ", note.note_type);
                        break;
                }
            }
        } catch (err) {
            console.error("Could not load nodes into A-Frame space", err);
        }
    }
});


AFRAME.registerComponent('txtnote', {
    schema: {
        id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        pos_x: { type: 'number' },
        pos_y: { type: 'number' },
        pos_z: { type: 'number' },
        rot_x: { type: 'number' },
        rot_y: { type: 'number' },
        rot_z: { type: 'number' },
        anchored: { type: 'boolean' }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.el.setAttribute('mixin', 'txtnote');
        this.init = true;
    },

    update: function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        el.setAttribute('position', { x: data.pos_x, y: data.pos_y, z: data.pos_z });
        // let width = Math.min(data.content.length * .05 + .25, 5);
        // console.log(width)
        // Width does not work...
        el.setAttribute('text', { value: data.content, width: 10 });
        if (!data.anchored) {
            el.setAttribute('look-at', '#camera');
        }
        else {
            el.removeAttribute('look-at');
            el.setAttribute('rotation', { x: data.rot_x, y: data.rot_y, z: data.rot_z })
        }

        if (this.init) {
            this.init = false;
        }
        else {
            noteService.updateTextNote(data.id, AFRAME.utils.diff(oldData, data));
        }
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        // cleanup when component is removed
    }
});

AFRAME.registerComponent('imgnote', {
    schema: {
        id: { type: 'string' },
        title: { type: 'string' },
        image: { type: 'string' },
        pos_x: { type: 'number' },
        pos_y: { type: 'number' },
        pos_z: { type: 'number' },
        rot_x: { type: 'number' },
        rot_y: { type: 'number' },
        rot_z: { type: 'number' },
        anchored: { type: 'boolean' }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.init = true;
    },

    update: function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        el.setAttribute('position', { x: data.pos_x, y: data.pos_y, z: data.pos_z });
        el.setAttribute('src', data.image);
        if (!data.anchored) {
            el.setAttribute('look-at', '#camera');
        }
        else {
            el.removeAttribute('look-at');
            el.setAttribute('rotation', { x: data.rot_x, y: data.rot_y, z: data.rot_z })
        }

        if (this.init) {
            this.init = false;
        }
        else {
            // TODO
            //noteService.updateImageNote(data.id, AFRAME.utils.diff(oldData, data));
        }
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        // cleanup when component is removed
    }
});

AFRAME.registerComponent('arrnote', {
    schema: {
        id: { type: 'string' },
        title: { type: 'string' },
        pos_x: { type: 'number' },
        pos_y: { type: 'number' },
        pos_z: { type: 'number' },
        pos2_x: { type: 'number' },
        pos2_y: { type: 'number' },
        pos2_z: { type: 'number' }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.init = true;
    },

    update: function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        el.setAttribute('position', { x: data.pos_x, y: data.pos_y, z: data.pos_z });

        // 1. Convert inputs to Three.js Vectors for math operations
        const pStart = new THREE.Vector3(0, 0, 0);
        const pEnd = new THREE.Vector3(data.pos2_x - data.pos_x, data.pos2_y - data.pos_y, data.pos2_z - data.pos_z);

        // 2. Calculate the main shaft direction and length
        const direction = new THREE.Vector3().subVectors(pEnd, pStart).normalize();

        // 3. Define arrowhead properties
        const headLength = 0.3; // How long the arrow fins are
        const headAngle = 0.35; // The spread angle of the fins (in radians)

        // 4. Find an arbitrary perpendicular axis to rotate our fins around
        // If the arrow points straight up/down, use X axis; otherwise use Y axis
        const up = Math.abs(direction.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(direction, up).normalize();
        const normalUp = new THREE.Vector3().crossVectors(right, direction).normalize();

        // 5. Calculate fin vectors by rotating the inverted direction vector backwards
        const invDir = direction.clone().negate();

        // Fin 1: Rotated left
        const finDir1 = invDir.clone().applyAxisAngle(right, headAngle).normalize().multiplyScalar(headLength);
        // Fin 2: Rotated right
        const finDir2 = invDir.clone().applyAxisAngle(right, -headAngle).normalize().multiplyScalar(headLength);
        // Fin 3 & 4 (Optional but makes it look 3D from all sides): Rotated up and down
        const finDir3 = invDir.clone().applyAxisAngle(normalUp, headAngle).normalize().multiplyScalar(headLength);
        const finDir4 = invDir.clone().applyAxisAngle(normalUp, -headAngle).normalize().multiplyScalar(headLength);

        // 6. Calculate absolute endpoints for the fins branching away from pEnd
        const finEnd1 = pEnd.clone().add(finDir1);
        const finEnd2 = pEnd.clone().add(finDir2);
        const finEnd3 = pEnd.clone().add(finDir3);
        const finEnd4 = pEnd.clone().add(finDir4);

        // Helper function to format vectors for A-Frame strings
        const fmt = (v) => `${v.x} ${v.y} ${v.z}`;

        const color = "red";
        // 7. Apply the multiple line components directly to your A-Frame entity
        el.setAttribute('line', `start: ${fmt(pStart)}; end: ${fmt(pEnd)}; color: ${color}`);
        el.setAttribute('line__fin1', `start: ${fmt(pEnd)}; end: ${fmt(finEnd1)}; color: ${color}`);
        el.setAttribute('line__fin2', `start: ${fmt(pEnd)}; end: ${fmt(finEnd2)}; color: ${color}`);
        el.setAttribute('line__fin3', `start: ${fmt(pEnd)}; end: ${fmt(finEnd3)}; color: ${color}`);
        el.setAttribute('line__fin4', `start: ${fmt(pEnd)}; end: ${fmt(finEnd4)}; color: ${color}`);

        if (this.init) {
            this.init = false;
        }
        else {
            noteService.updateArrowNote(data.id, AFRAME.utils.diff(oldData, data));
        }
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        // cleanup when component is removed
    }
});