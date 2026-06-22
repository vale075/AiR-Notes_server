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

        const validateBtnEl = document.querySelector("#uiBtn");
        const uiTxtEl = document.querySelector("#uiTxt");
        const coordinatesMarkerEl = document.querySelector("#coordinatesMarker");
        const qrUiEl = document.querySelector("#qrUi");
        this.notesEl = document.querySelector("#notes");

        const surfaceNormal = new THREE.Vector3();
        const cameraPosition = new THREE.Vector3();
        const rotationMatrix = new THREE.Matrix4();
        const xAxis = new THREE.Vector3();
        const yAxis = new THREE.Vector3();

        this.positionQRcode = (event) => {
            if (!this.elToMove) {
                return;
            }
            const { position, orientation } = event.detail;

            // 1. Position
            const hitPos = new THREE.Vector3();
            this.elToMove.object3D.position.set(position.x, position.y, position.z);
            coordinatesMarkerEl.object3D.position.set(position.x, position.y, position.z);

            // 2. Surface normal — derived correctly from the hit pose's quaternion.
            // Per the WebXR hit-test spec, the Y axis of that quaternion's local frame
            // is defined to align with the surface normal; orientation.x/y/z alone is
            // not a usable direction.
            const hitQuaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w);
            surfaceNormal.set(0, 1, 0).applyQuaternion(hitQuaternion).normalize();

            // 3. Camera world position
            const cameraEl = this.el.sceneEl.camera;
            cameraEl.getWorldPosition(cameraPosition);

            let tempUp = new THREE.Vector3(0, 1, 0);

            if (Math.abs(surfaceNormal.y) > 0.9) {
                // Floor/ceiling: derive "up" from camera POSITION relative to the hit
                // point, not camera orientation — the hit-test ray can land off-center
                // from where the camera is actually pointed.
                const hitPosition = new THREE.Vector3(position.x, position.y, position.z);
                const awayFromCamera = hitPosition.clone().sub(cameraPosition);
                awayFromCamera.projectOnPlane(surfaceNormal);

                // Degenerate case: tapping almost directly below the camera leaves a
                // near-zero horizontal component — normalizing that gives NaN. Fall
                // back to a fixed world direction instead.
                if (awayFromCamera.lengthSq() < 1e-6) {
                    awayFromCamera.set(0, 0, -1).projectOnPlane(surfaceNormal);
                }
                tempUp.copy(awayFromCamera.normalize());
            }

            // 4-7. Build the orthonormal basis — unchanged, this part was already correct
            xAxis.crossVectors(tempUp, surfaceNormal).normalize();
            yAxis.crossVectors(surfaceNormal, xAxis).normalize();
            rotationMatrix.makeBasis(xAxis, yAxis, surfaceNormal);

            this.elToMove.object3D.quaternion.setFromRotationMatrix(rotationMatrix);
            coordinatesMarkerEl.object3D.quaternion.setFromRotationMatrix(rotationMatrix);
            if (this.elToMove != this.el) {
                var worldToLocal = new THREE.Matrix4().copy(this.el.object3D.matrixWorld).invert();
                this.elToMove.object3D.applyMatrix4(worldToLocal);
            }

            this.elToMove.object3D.visible = true;
            coordinatesMarkerEl.object3D.visible = true;
            validateBtnEl.object3D.visible = true;
        };

        this.elToMove = this.el;
        this.el.sceneEl.addEventListener("ar-hit-test-select", this.positionQRcode);

        validateBtnEl.addEventListener("click", (event) => {
            this.elToMove = false;
            validateBtnEl.object3D.visible = false;
            uiTxtEl.object3D.visible = false;
            coordinatesMarkerEl.object3D.visible = false;
            qrUiEl.object3D.visible = true;
            this.notesEl.object3D.visible = true;
        }, { once: true });

        const closeNoteBtnEl = document.querySelector("#closeNoteBtn");

        closeNoteBtnEl.addEventListener("click", (event) => {
            location.reload();
        })

        const newTxtNoteBtnEL = document.querySelector("#newTxtNoteBtn");

        newTxtNoteBtnEL.addEventListener("click", (event) => {
            const el = document.createElement('a-entity');
            el.setAttribute('visible', false);
            el.setAttribute('txtnote', { qrcode_id: this.currentQrId, temporary: true });
            this.notesEl.appendChild(el);

            validateBtnEl.addEventListener("click", (event) => {
                this.elToMove = false;
                uiTxtEl.object3D.visible = false;
                validateBtnEl.object3D.visible = false;
                coordinatesMarkerEl.object3D.visible = false;
                newTxtNoteBtnEL.emit('mouseleave', {}, false);
                el.setAttribute('txtnote', 'temporary', false);
            }, { once: true });

            uiTxtEl.setAttribute('value', "Cliquez sur l'emplacement voulu");

            this.elToMove = el;

            uiTxtEl.object3D.visible = true;
        })

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
                delete note.updated_at;
                delete note.created_at;
                const note_type = note.note_type;
                delete note.note_type;
                switch (note_type) {
                    case 'TXT': {
                        const el = document.createElement('a-entity');
                        el.setAttribute('txtnote', note);
                        this.notesEl.appendChild(el);
                        break;
                    }
                    case 'IMA': {
                        const el = document.createElement('a-image');
                        el.setAttribute('imgnote', note);
                        this.notesEl.appendChild(el);
                        break;
                    }
                    case 'ARR': {
                        const el = document.createElement('a-entity');
                        el.setAttribute('arrnote', note);
                        this.notesEl.appendChild(el);
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
        content: { type: 'string', default: "X" },
        pos_x: { type: 'number' },
        pos_y: { type: 'number' },
        pos_z: { type: 'number' },
        rot_x: { type: 'number' },
        rot_y: { type: 'number' },
        rot_z: { type: 'number' },
        anchored: { type: 'boolean', default: true },
        qrcode_id: { type: 'string' },
        temporary: { type: 'boolean', default: false }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.el.setAttribute('mixin', 'txtnote');

        this.editBtn = document.createElement('a-entity');
        this.editBtn.setAttribute('mixin', "uiBtnEditMixin");
        this.editBtn.setAttribute('class', "collidable");
        this.el.appendChild(this.editBtn);

        this.deleteBtn = document.createElement('a-entity');
        this.deleteBtn.setAttribute('mixin', "uiBtnDeleteMixin");
        this.deleteBtn.setAttribute('class', "collidable");
        this.deleteBtn.addEventListener('click', (event) => {
            this.el.parentNode.removeChild(this.el);
        });
        this.el.appendChild(this.deleteBtn);

        this.init = true;
    },

    update: async function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        if (this.init) {
            el.setAttribute('position', { x: data.pos_x, y: data.pos_y, z: data.pos_z });
        } else {
            const elPos = el.getAttribute('position');
            el.setAttribute('txtnote', 'pos_x', elPos.x);
            el.setAttribute('txtnote', 'pos_y', elPos.y);
            el.setAttribute('txtnote', 'pos_z', elPos.z);
        }
        console.log("update ran");
        // let width = Math.min(data.content.length * .05 + .25, 5);
        // console.log(width)
        el.setAttribute('text', { value: data.content });
        if (this.init && data.anchored) {
            el.setAttribute('rotation', { x: data.rot_x, y: data.rot_y, z: data.rot_z });
        } else {
            const elRot = el.getAttribute('rotation');
            el.setAttribute('txtnote', 'rot_x', elRot.x);
            el.setAttribute('txtnote', 'rot_y', elRot.y);
            el.setAttribute('txtnote', 'rot_z', elRot.z);
        }
        if (!data.anchored) {
            el.setAttribute('look-at', '#camera');
        }
        else {
            el.removeAttribute('look-at');
        }

        if (this.init) {
            this.init = false;
        }
        else if (!data.temporary) {
            if (data.id) {
                noteService.updateTextNote(data.id, AFRAME.utils.diff(oldData, data));
            } else {
                try {
                    const newnote = await noteService.createTextNote(data);
                    this.el.setAttribute('txtnote', 'id', newnote.id);
                } catch (err) {
                    console.error('Failed to create text note:', err);
                }
            }
        }
    },

    tick: function () {
        // runs every frame — keep it light
    },

    remove: function () {
        if (this.data.id) {
            noteService.deleteNote(this.data.id);
        }
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
        anchored: { type: 'boolean' },
        qrcode_id: { type: 'string' }
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
        noteService.deleteNote(this.data.id);
    }
});

/**
   * <a-entity arrow="start: x y z; end: x y z; color: #ff0000; shaftRadius: 0.02; headRadius: 0.06; headLength: 0.15">
   *
   * Builds a cylinder (shaft) + cone (head) pointing from `start` to `end`.
   * Coordinates are in the entity's local space (so you can also just move
   * the parent entity around and keep start/end relative).
   */
AFRAME.registerComponent('arrow', {
    schema: {
        start: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
        end: { type: 'vec3', default: { x: 0, y: 1, z: 0 } },
        color: { type: 'color', default: '#ffffff' },
        shaftRadius: { type: 'number', default: 0.02 },
        headRadius: { type: 'number', default: 0.06 },
        headLength: { type: 'number', default: 0.15 },
        opacity: { type: 'number', default: 1 }
    },

    init: function () {
        this.shaft = document.createElement('a-cylinder');
        this.head = document.createElement('a-cone');
        this.shaft.setAttribute('segments-radial', 12);
        this.head.setAttribute('segments-radial', 12);
        this.el.appendChild(this.shaft);
        this.el.appendChild(this.head);
    },

    update: function () {
        const data = this.data;
        const start = new THREE.Vector3(data.start.x, data.start.y, data.start.z);
        const end = new THREE.Vector3(data.end.x, data.end.y, data.end.z);

        const fullVec = new THREE.Vector3().subVectors(end, start);
        const totalLength = fullVec.length();

        if (totalLength < 1e-6) {
            // Degenerate arrow (start === end): hide geometry.
            this.shaft.setAttribute('visible', false);
            this.head.setAttribute('visible', false);
            return;
        }
        this.shaft.setAttribute('visible', true);
        this.head.setAttribute('visible', true);

        const dir = fullVec.clone().normalize();

        // Clamp head length so it never exceeds the full arrow length.
        const headLength = Math.min(data.headLength, totalLength * 0.8);
        const shaftLength = Math.max(totalLength - headLength, 0.0001);

        // Default A-Frame cylinder/cone primitives are authored pointing
        // along +Y, centered at their own origin. We rotate +Y onto `dir`.
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir
        );

        const shaftCenter = start.clone().addScaledVector(dir, shaftLength / 2);
        const headBase = start.clone().addScaledVector(dir, shaftLength);
        const headCenter = headBase.clone().addScaledVector(dir, headLength / 2);

        this.shaft.setAttribute('radius', data.shaftRadius);
        this.shaft.setAttribute('height', shaftLength);
        this.shaft.setAttribute('color', data.color);
        this.shaft.setAttribute('opacity', data.opacity);
        this.shaft.object3D.position.copy(shaftCenter);
        this.shaft.object3D.quaternion.copy(quaternion);

        this.head.setAttribute('radius-bottom', data.headRadius);
        this.head.setAttribute('radius-top', 0);
        this.head.setAttribute('height', headLength);
        this.head.setAttribute('color', data.color);
        this.head.setAttribute('opacity', data.opacity);
        this.head.object3D.position.copy(headCenter);
        this.head.object3D.quaternion.copy(quaternion);
    },

    remove: function () {
        if (this.shaft) this.shaft.remove();
        if (this.head) this.head.remove();
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
        pos2_z: { type: 'number' },
        qrcode_id: { type: 'string' }
    },

    init: function () {
        // runs once when the component is attached to an entity
        this.init = true;
    },

    update: function (oldData) {
        // runs when schema properties change at runtime
        const el = this.el;
        const data = this.data;

        const pStart = new THREE.Vector3(data.pos_x, data.pos_y, data.pos_z);
        const pEnd = new THREE.Vector3(data.pos2_x, data.pos2_y, data.pos2_z);

        el.setAttribute('arrow', { start: pStart, end: pEnd, color: "red" });

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
        noteService.deleteNote(this.data.id);
    }
});


// Component to change to a sequential color on click.
AFRAME.registerComponent('custom-cursor', {
    init: function () {
        const el = this.el;

        const handEl = document.querySelector("#rightHand");
        handEl.addEventListener('pinchstarted', function () {
            el.setAttribute('color', "yellow");
        })
        handEl.addEventListener('pinchended', function () {
            el.setAttribute('color', "white");
        })
    }
});

AFRAME.registerComponent('change-color-on-click', {
    init: function () {
        const el = this.el;

        // Listen for the tap/click event
        el.addEventListener('click', function () {
            // Generate a random color hex string
            const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

            // Change the target entity's color attribute
            el.setAttribute('material', 'color', randomColor);
        });
    }
});