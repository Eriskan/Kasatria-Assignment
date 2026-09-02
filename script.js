import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

		let camera, scene, renderer, controls;
		const objects = [];
		const targets = { table: [], sphere: [], helix: [], grid: [] };
		let peopleData = [];

		/* ---------------------------------------------------------------
		   STEP 1: GOOGLE SIGN-IN
		--------------------------------------------------------------- */
		window.onload = function () {
			if (window.google && window.GOOGLE_CLIENT_ID.indexOf('YOUR_GOOGLE') === -1) {
				google.accounts.id.initialize({
					client_id: window.GOOGLE_CLIENT_ID,
					callback: handleCredentialResponse
				});
				google.accounts.id.renderButton(
					document.getElementById('g_id_signin_container'),
					{ theme: 'outline', size: 'large', text: 'signin_with' }
				);
			} else {
				document.getElementById('login-error').style.display = 'block';
				document.getElementById('login-error').textContent =
					'Google Client ID not configured yet (see CONFIGURATION section in the HTML source).';
			}
		};

		function decodeJwt(token) {
			const base64Url = token.split('.')[1];
			const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
			return JSON.parse(decodeURIComponent(atob(base64).split('').map(c =>
				'%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
		}

		function handleCredentialResponse(response) {
			const profile = decodeJwt(response.credential);

			document.getElementById('login-screen').style.display = 'none';
			document.getElementById('loading-screen').style.display = 'flex';

			const badge = document.getElementById('user-badge');
			badge.innerHTML = `<img src="${profile.picture}" referrerpolicy="no-referrer"> ${profile.name}
				<button id="signout-btn">Sign out</button>`;

			document.getElementById('signout-btn').addEventListener('click', () => {
				window.location.reload();
			});

			loadSheetData();
		}

		/* ---------------------------------------------------------------
		   STEP 2: LOAD DATA FROM GOOGLE SHEET (published CSV)
		--------------------------------------------------------------- */
		function loadSheetData() {
			if (!window.SHEET_CSV_URL || window.SHEET_CSV_URL.indexOf('YOUR_PUBLISHED') !== -1) {
				document.getElementById('loading-screen').textContent =
					'SHEET_CSV_URL is not configured yet (see CONFIGURATION section in the HTML source).';
				return;
			}

			Papa.parse(window.SHEET_CSV_URL, {
				download: true,
				header: true,
				skipEmptyLines: true,
				complete: function (results) {
					peopleData = results.data.map(row => ({
						name: row['Name'],
						photo: row['Photo'],
						age: row['Age'],
						country: row['Country'],
						interest: row['Interest'],
						netWorth: parseFloat((row['Net Worth'] || '0').replace(/[$,]/g, ''))
					})).filter(p => p.name);

					document.getElementById('loading-screen').style.display = 'none';
					document.getElementById('app').style.display = 'block';
					initScene();
					animate();
				},
				error: function (err) {
					document.getElementById('loading-screen').textContent =
						'Failed to load the Google Sheet CSV. Make sure it is Published to the web. (' + err + ')';
				}
			});
		}

		/* ---------------------------------------------------------------
		   STEP 3: BUILD THE 3D SCENE
		--------------------------------------------------------------- */
		function netWorthColor(value) {
			if (value < 100000) return 'rgba(231,76,60,0.55)';   // red
			if (value > 200000) return 'rgba(46,204,113,0.55)';  // green
			return 'rgba(243,156,18,0.55)';                      // orange
		}

		function initScene() {
			camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
			camera.position.z = 3000;
			scene = new THREE.Scene();

			peopleData.forEach((person, i) => {
				const card = document.createElement('div');
				card.className = 'card ' + (i < peopleData.length / 2 ? 'strand-a' : 'strand-b');
				card.style.backgroundColor = netWorthColor(person.netWorth);

				const photo = document.createElement('img');
				photo.className = 'photo';
				photo.src = person.photo;
				photo.onerror = () => { photo.style.display = 'none'; };
				card.appendChild(photo);

				const name = document.createElement('div');
				name.className = 'name';
				name.textContent = person.name;
				card.appendChild(name);

				const details = document.createElement('div');
				details.className = 'details';
				details.textContent = `${person.age} | ${person.country} | ${person.interest}`;
				card.appendChild(details);

				const nw = document.createElement('div');
				nw.className = 'networth';
				nw.textContent = '$' + person.netWorth.toLocaleString('en-US', { maximumFractionDigits: 0 });
				card.appendChild(nw);

				const objectCSS = new CSS3DObject(card);
				objectCSS.position.x = Math.random() * 4000 - 2000;
				objectCSS.position.y = Math.random() * 4000 - 2000;
				objectCSS.position.z = Math.random() * 4000 - 2000;
				scene.add(objectCSS);
				objects.push(objectCSS);
			});

			buildTargets();

			renderer = new CSS3DRenderer();
			renderer.setSize(window.innerWidth, window.innerHeight);
			document.getElementById('container').appendChild(renderer.domElement);

			controls = new TrackballControls(camera, renderer.domElement);
			controls.minDistance = 500;
			controls.maxDistance = 6000;
			controls.addEventListener('change', render);

			document.getElementById('table').addEventListener('click', () => transform(targets.table, 2000));
			document.getElementById('sphere').addEventListener('click', () => transform(targets.sphere, 2000));
			document.getElementById('helix').addEventListener('click', () => transform(targets.helix, 2000));
			document.getElementById('grid').addEventListener('click', () => transform(targets.grid, 2000));

			transform(targets.table, 2000);

			window.addEventListener('resize', onWindowResize);
		}

		function buildTargets() {
			const n = objects.length;

			/* ---- TABLE: 20 columns x 10 rows, row-major ---- */
			const TABLE_COLS = 20;
			const TABLE_ROWS = 10;
			const cellW = 150, cellH = 190;
			for (let i = 0; i < n; i++) {
				const col = i % TABLE_COLS;
				const row = Math.floor(i / TABLE_COLS) % TABLE_ROWS;
				const object = new THREE.Object3D();
				object.position.x = (col * cellW) - (TABLE_COLS * cellW) / 2 + cellW / 2;
				object.position.y = -(row * cellH) + (TABLE_ROWS * cellH) / 2 - cellH / 2;
				object.position.z = 0;
				targets.table.push(object);
			}

			/* ---- SPHERE: Fibonacci sphere distribution ---- */
			const vector = new THREE.Vector3();
			for (let i = 0; i < n; i++) {
				const phi = Math.acos(-1 + (2 * i) / n);
				const theta = Math.sqrt(n * Math.PI) * phi;
				const object = new THREE.Object3D();
				object.position.setFromSphericalCoords(900, phi, theta);
				vector.copy(object.position).multiplyScalar(2);
				object.lookAt(vector);
				targets.sphere.push(object);
			}

						/* ---- DOUBLE HELIX: dataset split in half, each half forms its own
			   full spiral. The two spirals share the same axis and pitch but
			   are rotated 180 degrees apart, so they mirror each other as they
			   wind up, like the two backbones of a DNA double helix. */
			const HELIX_RADIUS = 750;
			const THETA_STEP = 0.22;   // radians per step around the axis (fewer revolutions = less overlap)
			const Y_STEP = 55;         // vertical rise per step (taller, more open coil)
			const half = Math.ceil(n / 2);
			for (let i = 0; i < n; i++) {
				const strand = i < half ? 0 : 1;              // 0 = strand A, 1 = strand B
				const step = strand === 0 ? i : i - half;      // position within that strand
				const theta = step * THETA_STEP + Math.PI + (strand === 1 ? Math.PI : 0);
				const y = -(step * Y_STEP) + 800;
				const object = new THREE.Object3D();
				object.position.setFromCylindricalCoords(HELIX_RADIUS, theta, y);
				vector.x = object.position.x * 2;
				vector.y = object.position.y;
				vector.z = object.position.z * 2;
				object.lookAt(vector);
				targets.helix.push(object);
			}

			/* ---- GRID: 5 (x) by 4 (y) by 10 (z) ---- */
			const GRID_X = 5, GRID_Y = 4, GRID_Z = 10;
			const spacingX = 400, spacingY = 400, spacingZ = 600;
			for (let i = 0; i < n; i++) {
				const perLayer = GRID_X * GRID_Y;
				const x = i % GRID_X;
				const y = Math.floor(i / GRID_X) % GRID_Y;
				const z = Math.floor(i / perLayer) % GRID_Z;
				const object = new THREE.Object3D();
				object.position.x = (x * spacingX) - (GRID_X * spacingX) / 2 + spacingX / 2;
				object.position.y = -(y * spacingY) + (GRID_Y * spacingY) / 2 - spacingY / 2;
				object.position.z = (z * spacingZ) - (GRID_Z * spacingZ) / 2;
				targets.grid.push(object);
			}
		}

		function transform(targetsArr, duration) {
			TWEEN.removeAll();
			for (let i = 0; i < objects.length; i++) {
				const object = objects[i];
				const target = targetsArr[i];
				if (!target) continue;

				new TWEEN.Tween(object.position)
					.to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
					.easing(TWEEN.Easing.Exponential.InOut)
					.start();

				new TWEEN.Tween(object.rotation)
					.to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
					.easing(TWEEN.Easing.Exponential.InOut)
					.start();
			}
			new TWEEN.Tween({})
				.to({}, duration * 2)
				.onUpdate(render)
				.start();
		}

		function onWindowResize() {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
			render();
		}

		function animate() {
			requestAnimationFrame(animate);
			TWEEN.update();
			controls.update();
		}

		function render() {
			renderer.render(scene, camera);
		}
