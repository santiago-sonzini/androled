"use client";

import { useState, useRef } from "react";
import { updateGuestNroPulsera } from "../actions/guests";

interface Guest {
  id: string;
  name: string;
  email: string;
  goesWith: string;
  mesa: string;
  nroPulsera: string;
}

const GUESTS: Guest[] = [{"id": "cmoutez6e00019rv21f8y4yau", "name": "Maxi", "email": "mlcalvo@transcal.com.ar", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoutezno00029rv2lzi9ywl2", "name": "Pietri", "email": "", "goesWith": "Maxi", "mesa": "", "nroPulsera": ""}, {"id": "cmoutezno00039rv2xpr6f5qa", "name": "Agos", "email": "", "goesWith": "Maxi", "mesa": "", "nroPulsera": ""}, {"id": "cmoutezno00049rv2c3r7r9bz", "name": "Viggo", "email": "", "goesWith": "Maxi", "mesa": "", "nroPulsera": ""}, {"id": "cmoxhycgm000113km49gsgl4p", "name": "Agustin Tagliavini", "email": "tagliabiniagustin@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxhzofp000313km4bdcym2w", "name": "Catalina Menegozzi", "email": "menegozzic@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxi20h1000513kmcybx3l0j", "name": "Agustin Tagliavini", "email": "tagliabiniagustin@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxi2ufu000713kmftkyv7nt", "name": "Alma Sanchez", "email": "almitasanchez554@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxi4kxv000913kmbly96qqj", "name": "Azucena López", "email": "azulopezz758@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxi4ulg000b13kmyfk3b59k", "name": "Felipe Castelli", "email": "felipecastelliloszorros@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxi8pp3000d13kmnkxpft92", "name": "agustin cejas", "email": "cejasagustin066@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxia1w5000f13kmmdlqr7ll", "name": "Lucas Canta", "email": "lucascanta407@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxiadar000h13km72tbdyfm", "name": "Renata cerutti", "email": "ceruttirenata3@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxick31000j13kmjzruw9m1", "name": "Pía Alemanni", "email": "Pialemanni27@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxid780000l13kmuduoify0", "name": "Samuel Pereyra", "email": "pereyrasamuel224@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxiqsk90001ejatwfoxumoa", "name": "Enzo Deheza", "email": "enzodeheza9@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjd5o10001igo1q1193jce", "name": "Jesica Caverzasi", "email": "jesicaverzasi@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjd6530002igo1l6bbbmh1", "name": "Damián Ambroggio", "email": "", "goesWith": "Jesica Caverzasi", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjd6530003igo1f8ge8ue6", "name": "Pilar Ambroggio", "email": "", "goesWith": "Jesica Caverzasi", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjd6530004igo1bphlf0rr", "name": "Clara Ambroggio", "email": "", "goesWith": "Jesica Caverzasi", "mesa": "", "nroPulsera": ""}, {"id": "cmoxje1v10006igo1luvjmgyc", "name": "Lucrecia Ambroggio", "email": "Lucrecia_ambroggio@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxje2aw0007igo14zc1wzv9", "name": "Cerutti Claudio", "email": "", "goesWith": "Lucrecia Ambroggio", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjg1rp0009igo1jm7s9vqi", "name": "Alma Montenegro", "email": "alma09.montenegro@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjgobw000bigo11cag1i44", "name": "Nati Alemanni", "email": "natialemanni@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjgos1000cigo1688pl975", "name": "Fabri Garetto", "email": "", "goesWith": "Nati Alemanni", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjjvsm000eigo14kgp03ua", "name": "Irina Foos", "email": "iriifoos@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjk5fl000gigo1337v7qte", "name": "Milena Garello", "email": "milegarello4@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjo5w4000iigo1jaoc64f4", "name": "pamela zamudio", "email": "pamelazamudio30@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjo6bx000jigo1hkuraurg", "name": "Javier Cerutti", "email": "", "goesWith": "pamela zamudio", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjqz0q000ligo1gfeqkpbj", "name": "andrea foglio", "email": "andreafoglio679@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjqzgo000migo1ltrlztls", "name": "Juárez ariel", "email": "", "goesWith": "andrea foglio", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjrbky000oigo1ezootecm", "name": "Micaela Chiavassa", "email": "chiavassamica@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjrc0u000pigo1vkm8gnwa", "name": "Tomas Cattelan", "email": "", "goesWith": "Micaela Chiavassa", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjtq9c000rigo1342zsj2d", "name": "Zulema gonzalez", "email": "gzulema209@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjwhls000tigo1pdgws8g7", "name": "Marilina Fachinetti", "email": "marilinafachinetti@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjwi1o000uigo142qgzp25", "name": "Hernan Santoro", "email": "", "goesWith": "Marilina Fachinetti", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjwi1o000vigo15ttj7qo9", "name": "Renzo Santoro", "email": "", "goesWith": "Marilina Fachinetti", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjwi1o000wigo1vfq4l7j2", "name": "Julia Santoro", "email": "", "goesWith": "Marilina Fachinetti", "mesa": "", "nroPulsera": ""}, {"id": "cmoxjyen7000yigo1a93t9njb", "name": "Tiago Mano", "email": "manotiago81@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxk95e400013dp89sojejpb", "name": "Aguirre Dionel", "email": "aguirredionel22@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxkh9qb000110xgjmyrx9b9", "name": "Lautaro Brusa", "email": "brusalautaro19@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxksb4y0001ut5e275c0w86", "name": "Troxler Brenda", "email": "brencrecer1@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxksblt0002ut5e34af3or9", "name": "Rosina maico", "email": "", "goesWith": "Troxler Brenda", "mesa": "", "nroPulsera": ""}, {"id": "cmoxksblt0003ut5egi82hbck", "name": "Rosina Emma", "email": "", "goesWith": "Troxler Brenda", "mesa": "", "nroPulsera": ""}, {"id": "cmoxksblt0004ut5evk70gqe0", "name": "Rosina Julia", "email": "", "goesWith": "Troxler Brenda", "mesa": "", "nroPulsera": ""}, {"id": "cmoxktx3q0001a0usd9ry3fx0", "name": "Elizabeth Argüello", "email": "elizabeth.arguello1981@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxktxjf0002a0useqm0z1d2", "name": "Marcos Nieto", "email": "", "goesWith": "Elizabeth Argüello", "mesa": "", "nroPulsera": ""}, {"id": "cmoxktxjf0003a0usu17tj1yb", "name": "Alma Nieto", "email": "", "goesWith": "Elizabeth Argüello", "mesa": "", "nroPulsera": ""}, {"id": "cmoxl1jha00017kqov1rgyd63", "name": "Troxler Malen", "email": "malentroxler97@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoxl1k0q00027kqorgha9qpz", "name": "Dutto Juan", "email": "", "goesWith": "Troxler Malen", "mesa": "", "nroPulsera": ""}, {"id": "cmoxl1k0r00037kqoxfetahrk", "name": "Mío Olivia", "email": "", "goesWith": "Troxler Malen", "mesa": "", "nroPulsera": ""}, {"id": "cmoye919x0001uxszx7knds1f", "name": "Carolina Cresimbeni", "email": "carocresimbeni@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoye91re0002uxszw6ip0xe7", "name": "CHIAVASSA MARIANO", "email": "", "goesWith": "Carolina Cresimbeni", "mesa": "", "nroPulsera": ""}, {"id": "cmoye91re0003uxszs5qbdyta", "name": "CHIAVASSA VALENTINA", "email": "", "goesWith": "Carolina Cresimbeni", "mesa": "", "nroPulsera": ""}, {"id": "cmoyetked0001b5srxzaiz6bd", "name": "Catalina Piva", "email": "catapiva2010@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoyjjuc00001192brvrel7r0", "name": "Analia Cremasco", "email": "analiacremasco.ac@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoyjjutb0002192bzhdrcm4u", "name": "Lione Ignacio", "email": "", "goesWith": "Analia Cremasco", "mesa": "", "nroPulsera": ""}, {"id": "cmoyvfz0u00014yb10z73rb9j", "name": "Isabella Romagnoli", "email": "isa.romagnoli1006@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoyvltel00034yb1g9luar5d", "name": "Lucrecia Servetti", "email": "lucreeservetti@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoz05v530001bmutrw9sejb0", "name": "Pablo Costamagna", "email": "pablocostamagna7@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoz05vl80002bmutnqgj6e25", "name": "Noelia Puntonet", "email": "", "goesWith": "Pablo Costamagna", "mesa": "", "nroPulsera": ""}, {"id": "cmoz05vl80003bmut340kj02n", "name": "Helena Costamagna", "email": "", "goesWith": "Pablo Costamagna", "mesa": "", "nroPulsera": ""}, {"id": "cmoz05vl80004bmutx0jsmv0c", "name": "Amanda Costamagna", "email": "", "goesWith": "Pablo Costamagna", "mesa": "", "nroPulsera": ""}, {"id": "cmoz05vl80005bmutqyh190sx", "name": "Emilio Costamagna", "email": "", "goesWith": "Pablo Costamagna", "mesa": "", "nroPulsera": ""}, {"id": "cmoz4tofg0001w6jp3wt9xcau", "name": "JUAN CRUZ PLEITAVINO", "email": "juancruzpleitavino@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoztg9xe0001wt4s9oqaycf3", "name": "Carlos Jose Mano", "email": "carlitosjmano@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmoztgaev0002wt4s9io4u4sz", "name": "Tania Ambroggio", "email": "", "goesWith": "Carlos Jose Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmozvvjo70001azvo6p18ryjv", "name": "Fernanda Pérez", "email": "fernandaperez230@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmozvvk540002azvo2j7gc9l8", "name": "Facundo Foglio", "email": "", "goesWith": "Fernanda Pérez", "mesa": "", "nroPulsera": ""}, {"id": "cmozwkdjs0001br11phng7xta", "name": "SUSANA M.  DEMARCHI", "email": "susanademarchi19@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmozwke050002br11xv26re11", "name": "Rocio colazo", "email": "", "goesWith": "SUSANA M.  DEMARCHI", "mesa": "", "nroPulsera": ""}, {"id": "cmozwke050003br11r4ozo4al", "name": "Alfredo truccone", "email": "", "goesWith": "SUSANA M.  DEMARCHI", "mesa": "", "nroPulsera": ""}, {"id": "cmozyueaj0001keau2w6o3iqm", "name": "LAUREANO CALVO", "email": "lrcalvo@transcal.com.ar", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmozyuern0002keau3s1h73fz", "name": "Irene del Carmen Tissera", "email": "", "goesWith": "LAUREANO CALVO", "mesa": "", "nroPulsera": ""}, {"id": "cmozyuern0003keauwijq8tyv", "name": "Emilce del Carmen Calvo", "email": "", "goesWith": "LAUREANO CALVO", "mesa": "", "nroPulsera": ""}, {"id": "cmozyuern0004keauavl6wf8q", "name": "Gael Calvo", "email": "", "goesWith": "LAUREANO CALVO", "mesa": "", "nroPulsera": ""}, {"id": "cmozyuern0005keau4jtmmlvi", "name": "Sara Victoria Calvo", "email": "", "goesWith": "LAUREANO CALVO", "mesa": "", "nroPulsera": ""}, {"id": "cmp02qhu00001hg65g2yj2q46", "name": "Jose Combale", "email": "josecombale@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp02qias0002hg65pehlk0uj", "name": "Laura Costamagna", "email": "", "goesWith": "Jose Combale", "mesa": "", "nroPulsera": ""}, {"id": "cmp02vwq40004hg658p98iidr", "name": "Ines combale", "email": "josecombale@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp02w8hz0006hg65z18zkz7u", "name": "Cecilia Combale", "email": "ceciliacombale@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp04lk4g00017d54jbrsbvby", "name": "Laura colazo", "email": "lauri_avril04@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp0g4w0m00016j97qkwhq5j8", "name": "Julieta Pleitavino", "email": "julietapleitavinoo@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp1o1oj20001xnkinj038641", "name": "Liliana Formia", "email": "lilianadelcformia@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp1o1p080002xnkisge4yult", "name": "Ricardo Dutto", "email": "", "goesWith": "Liliana Formia", "mesa": "", "nroPulsera": ""}, {"id": "cmp31bdwh0001ryrjnr1ln2mg", "name": "Thiago truccone", "email": "thiagotruccone63@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp43mycq0001m0y2eq29oe36", "name": "Andrea Santi", "email": "andreaveronica686@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp43myua0002m0y2eg6vnrfi", "name": "Ariel Laspita", "email": "", "goesWith": "Andrea Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmp43myua0003m0y2ucsmdvkq", "name": "Lucia Laspita", "email": "", "goesWith": "Andrea Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmp43myua0004m0y2vh563069", "name": "Marco Onofrio", "email": "", "goesWith": "Andrea Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmp8si6h5000113w8imhd93gh", "name": "Gerardo Mano", "email": "gerardomano1958@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmp8si6y6000213w810uygugn", "name": "Norbis Servino", "email": "", "goesWith": "Gerardo Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmpad07t60001vbm2s5kw3vc4", "name": "MARIANGEL SANTI", "email": "santimariangel@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpad08a30002vbm2z1kjehm5", "name": "NICOLAS DEL VAL", "email": "", "goesWith": "MARIANGEL SANTI", "mesa": "", "nroPulsera": ""}, {"id": "cmpbs4r8i0001274sriqn83py", "name": "pereyra mauro", "email": "mauro555pereyra@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpd8ejuc0001s3hkoqeuthny", "name": "Santi Estefania", "email": "estefisantii@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpd8ekbh0002s3hk4y6guggx", "name": "Vieyra Nicolas", "email": "", "goesWith": "Santi Estefania", "mesa": "", "nroPulsera": ""}, {"id": "cmpd8zkh20001kafd0ax867id", "name": "Mauricio Mano", "email": "mauriciomano00@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpd8zkxr0002kafd6ah7gnon", "name": "Laura Angiolini", "email": "", "goesWith": "Mauricio Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmpd8zkxr0003kafdm77pqqyd", "name": "Tomás Mano", "email": "", "goesWith": "Mauricio Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmpd8zkxr0004kafdd0mf59wv", "name": "Virginia Cena", "email": "", "goesWith": "Mauricio Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmpd8zkxr0005kafdlqfvv4uw", "name": "Lorenzo Mano", "email": "", "goesWith": "Mauricio Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmpdd05ki00013va8wcnluloz", "name": "Carolina Santi", "email": "carolinasanti1082@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpdd062600023va8x952egj5", "name": "Ezequiel Boretti", "email": "", "goesWith": "Carolina Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpdd062600033va8hyvkxkfm", "name": "Delfina Boretti", "email": "", "goesWith": "Carolina Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpdd062600043va88pyeah3b", "name": "Josefina Boretti", "email": "", "goesWith": "Carolina Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpdd062600053va8pr1cshiu", "name": "Candela Boretti", "email": "", "goesWith": "Carolina Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpdd062600063va8um8uwh5d", "name": "Diego Colomino", "email": "", "goesWith": "Carolina Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpdypwmx0001keaqr00m7m9d", "name": "Micaela Riaudo", "email": "micariaudo@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpeeofoz0001smza15qegut4", "name": "David Costamagna", "email": "davidcostamagna@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpeeog6e0002smzauo2zugjw", "name": "Soledad Colazo", "email": "", "goesWith": "David Costamagna", "mesa": "", "nroPulsera": ""}, {"id": "cmpeeog6e0003smza5mbx8sn6", "name": "Julia Costamagna", "email": "", "goesWith": "David Costamagna", "mesa": "", "nroPulsera": ""}, {"id": "cmpek6ixh000112np9i1qouuf", "name": "Lorena Grosso", "email": "lorenabgrosso@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpek6jeq000212npoevq2oxo", "name": "Leonardo Tissera", "email": "", "goesWith": "Lorena Grosso", "mesa": "", "nroPulsera": ""}, {"id": "cmpek6jeq000312npx42hx94a", "name": "Lucia Tissera", "email": "", "goesWith": "Lorena Grosso", "mesa": "", "nroPulsera": ""}, {"id": "cmpek6jeq000412np130iqs9c", "name": "Ana Clara Tissera", "email": "", "goesWith": "Lorena Grosso", "mesa": "", "nroPulsera": ""}, {"id": "cmpen39xt0001ztjzajpj5loe", "name": "Silvina Mano", "email": "anivlisonam@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpen3afc0002ztjzzfjc15yr", "name": "Maximiliano Bizzutti", "email": "", "goesWith": "Silvina Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmpen3afc0003ztjz74zvssag", "name": "Antonio Bizzutti", "email": "", "goesWith": "Silvina Mano", "mesa": "", "nroPulsera": ""}, {"id": "cmpenh54l000173w8himk57o9", "name": "Oscar Santi", "email": "oscarsanti_50@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpenh5nv000273w8e3zz5qsh", "name": "Susana de Santi", "email": "", "goesWith": "Oscar Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpervwli0001zdxhzjmkxj6x", "name": "Alejandro Bergmans", "email": "alejandrobergmans@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpervx2y0002zdxh68id5rsi", "name": "Jesica Wagner", "email": "", "goesWith": "Alejandro Bergmans", "mesa": "", "nroPulsera": ""}, {"id": "cmpetm3t40001hra64vojvvsb", "name": "Maricel Peralta", "email": "peraltamaricel251@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpetm4aj0002hra6q4codjly", "name": "Juan Cabral", "email": "", "goesWith": "Maricel Peralta", "mesa": "", "nroPulsera": ""}, {"id": "cmpfgowzk0001g5ye0zearjps", "name": "Óscar Scorza y Pamela", "email": "oscar@econovo.com.ar", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpfgoxgl0002g5yeeddyju31", "name": "pamela", "email": "", "goesWith": "Óscar Scorza y Pamela", "mesa": "", "nroPulsera": ""}, {"id": "cmpfkoi4l00013lzy00hwasqn", "name": "María Celia  Squizzato", "email": "celiasquizzato@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpfn6qkq00018l6tw4smjnz7", "name": "Eliana Bonis", "email": "elianabonis84@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpfn6r1x00028l6tt0x8klbz", "name": "Villanueva Martín", "email": "", "goesWith": "Eliana Bonis", "mesa": "", "nroPulsera": ""}, {"id": "cmpfn6r1x00038l6tye9jw1qv", "name": "Garofani Emma", "email": "", "goesWith": "Eliana Bonis", "mesa": "", "nroPulsera": ""}, {"id": "cmpfn6r1x00048l6tgaezxj20", "name": "Villanueva Bautista", "email": "", "goesWith": "Eliana Bonis", "mesa": "", "nroPulsera": ""}, {"id": "cmpfonasc0001k6js7f52czp5", "name": "Lucia Combale", "email": "lucombale@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpg2hpu40001139a7ppbevk6", "name": "Micaela Lione", "email": "kikoservetti@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpg2hqct0002139am5edk5j3", "name": "Kiko servetti", "email": "", "goesWith": "Micaela Lione", "mesa": "", "nroPulsera": ""}, {"id": "cmpg2hqct0003139a5fm69dlt", "name": "Isabella servetti", "email": "", "goesWith": "Micaela Lione", "mesa": "", "nroPulsera": ""}, {"id": "cmpg2hqct0004139ac3kcz12h", "name": "Faustina Servetti", "email": "", "goesWith": "Micaela Lione", "mesa": "", "nroPulsera": ""}, {"id": "cmpg9yxxw0001115apjc5u31b", "name": "Julian Garcia Sanchez", "email": "lucombale@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpg9yyfd0002115a7lr1iwgi", "name": "Sixto Combale", "email": "", "goesWith": "Julian Garcia Sanchez", "mesa": "", "nroPulsera": ""}, {"id": "cmpg9yyfd0003115awgiulenm", "name": "Pio Combale", "email": "", "goesWith": "Julian Garcia Sanchez", "mesa": "", "nroPulsera": ""}, {"id": "cmpgvm1jj0001133b4eh1zuvv", "name": "Camila Vargas", "email": "camivargas701@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpgvm20v0002133bl02cg2m0", "name": "Villalon Gaspar", "email": "", "goesWith": "Camila Vargas", "mesa": "", "nroPulsera": ""}, {"id": "cmpgynj17000182cp9u6ldft8", "name": "Mariela Boretti", "email": "Mariela.a.boretti@hotmail.com.ar", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpgynji6000282cpg8l0s4p3", "name": "Claudio Malla", "email": "", "goesWith": "Mariela Boretti", "mesa": "", "nroPulsera": ""}, {"id": "cmphdg44g00019zabsj8d1nw1", "name": "Valeria Santoro", "email": "valessmaestri@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmphdg4o200029zabhrgqcqxr", "name": "Ariel Maestri", "email": "", "goesWith": "Valeria Santoro", "mesa": "", "nroPulsera": ""}, {"id": "cmpitygc60001p48vbhgy53ei", "name": "Lázaro Aguilar", "email": "lazaroaguilar227@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpiydwpq0001whfu9ttqidav", "name": "Juan Carlos Santi", "email": "jcsestaciondeservicio@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpiydx6t0002whfu3c5zlsuh", "name": "Adriana Cavagnero", "email": "", "goesWith": "Juan Carlos Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpj0izq00001y73xbk1l2ct3", "name": "Cesar Arnoletto", "email": "cesarprevero@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpj0j0620002y73xe0hqhg0k", "name": "Mariana de simone .", "email": "", "goesWith": "Cesar Arnoletto", "mesa": "", "nroPulsera": ""}, {"id": "cmpj0qq2i0004y73xj2jhfkng", "name": "Fernando Davanzo", "email": "fdavanzo@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpj0qqky0005y73xa8bkucqo", "name": "Mariana figueroa", "email": "", "goesWith": "Fernando Davanzo", "mesa": "", "nroPulsera": ""}, {"id": "cmpj0rj9h0007y73x3s4mjrwf", "name": "Noelia Calvo", "email": "ncalvo@transcal.com.ar", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpj0rjpj0008y73x1n30g7xf", "name": "Antón Troxler", "email": "", "goesWith": "Noelia Calvo", "mesa": "", "nroPulsera": ""}, {"id": "cmpj9eag90001o7ml5f72lhx1", "name": "Morena Campos", "email": "zoec2925@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpjdesj00001g22sjcfk65mg", "name": "Martinez Marisol", "email": "marisol.m.m054@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpjdh9fu0003g22secc0c00i", "name": "ludmila lione", "email": "ludmilalione2024@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpk6el7d00011994ytm9p8qw", "name": "Daniel Santi", "email": "santidanieldomingo@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpk6elns00021994d7krot0a", "name": "Karina Semenzin", "email": "", "goesWith": "Daniel Santi", "mesa": "", "nroPulsera": ""}, {"id": "cmpl7crre0001guxvhsox2wlo", "name": "Germán Celada", "email": "germanflacocelada@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpl7cs920002guxvjtlvq9zq", "name": "Betiana Mana", "email": "", "goesWith": "Germán Celada", "mesa": "", "nroPulsera": ""}, {"id": "cmpl91aej0001uvkcyxc2o8wn", "name": "Claudio Galiano", "email": "galianoclaudio28@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmplemzrn00013q27cbz14wh0", "name": "Héctor Calvo", "email": "hectorcalvo2017@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmplen08o00023q27vnsmxiuk", "name": "Florencia Mirtuono", "email": "", "goesWith": "Héctor Calvo", "mesa": "", "nroPulsera": ""}, {"id": "cmplen08p00033q27owsvd2bd", "name": "Sol Calvo", "email": "", "goesWith": "Héctor Calvo", "mesa": "", "nroPulsera": ""}, {"id": "cmplhyzky0001hg3gewrhmzpg", "name": "Héctor Calvo", "email": "hectorcalvo2017@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmplhz01x0002hg3gniq1g3lw", "name": "Mayco Belli", "email": "", "goesWith": "Héctor Calvo", "mesa": "", "nroPulsera": ""}, {"id": "cmplkadgw0001t5u26zt22p2j", "name": "Cuadrado Silvia", "email": "camilamago@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmplkadxu0002t5u26telqjt8", "name": "Mago gustavo", "email": "", "goesWith": "Cuadrado Silvia", "mesa": "", "nroPulsera": ""}, {"id": "cmpmp86sr0001hmtlwfzbqnon", "name": "Magda", "email": "natialemanni@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmrs2b7000113a6mdess2zi", "name": "Marta Costamagna", "email": "davidcostamagna@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmrugxs0001n26maw137wnc", "name": "Nelva celada", "email": "davidcostamagna@hotmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmsnmkt0001gp659c6fbihu", "name": "María Elisa celada", "email": "elisacelada1981@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmu4w2m0001yfw65ccw4msn", "name": "Álvaro Semenzin", "email": "alvaroosemenzin@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmub9tt0001oz4uafmxne9s", "name": "Jocelyn Villagra", "email": "jocelynvillagra653@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmukhtr000111iwny8i6hct", "name": "Micol comba", "email": "micolcomba647@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmuxvyz00018gfsx41mzs25", "name": "Luisiana olivero", "email": "oliveroluisiana03@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmv2fov0001pulgez1kqr62", "name": "Valentina villagra", "email": "villagrajorge696@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmvf5e4000113zqgem0ot9y", "name": "Julia Lione", "email": "julialione10@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmw2ybo0001551rnuzry147", "name": "More mol", "email": "morenakiaramolina658@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmwblz600013pqjm336f6on", "name": "Selena Moly", "email": "selenamoli07@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmwd7tc0001hu66ybkx5dlz", "name": "Malena Brest", "email": "brestmalena89@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmwg7mh0003hu6684mv2ybi", "name": "Lucia Piva", "email": "luciapiva2010@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmwo5jg0001zwnpa2zp9ial", "name": "Mailen Aguilar", "email": "aguilarmailen17@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmwpish00011es164j0ubz0", "name": "Mailen Aguilar", "email": "aguilarmailen17@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpmx0zw80001xo6fxnqm1pm4", "name": "Lucas Gallardo", "email": "lucasignaciogallardo577@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpn1x4ib00017650rdubtxhq", "name": "Rocio Donati", "email": "rociodonati643@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpnbhxsp0001oh9icr2ajq7u", "name": "Elías Zabala", "email": "zabalaelias2025@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpncszbr000121g1uewfpwkl", "name": "jeronimo servettij", "email": "servettijero@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpo4sdao0001ehyqq7veqqc7", "name": "Agustín López", "email": "elisacelada1981@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpo59l4z0001vc5z4zqkin7b", "name": "Celada gabriel", "email": "celadagabriel@yahoo.com.ar", "goesWith": "", "mesa": "", "nroPulsera": ""}, {"id": "cmpon50ti0001zjg4o7o8v7yc", "name": "Malvina Cerutti", "email": "malvinacerutti@gmail.com", "goesWith": "", "mesa": "", "nroPulsera": ""}];

function normalize(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

type ScanStatus = "idle" | "scanning" | "reading" | "writing" | "match" | "mismatch" | "error";

export default function NFCPage() {
  const [search, setSearch] = useState("");
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [readGuest, setReadGuest] = useState<Guest | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [writingNroPulsera, setWritingNroPulsera] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const isSupported = typeof window !== "undefined" && "NDEFReader" in window;

  async function startVerify() {
    if (!checkedId) return;
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); return; }

    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("scanning");
      setScanMessage("Acercá la pulsera NFC...");

      const ndef = new (window as any).NDEFReader();
      await ndef.scan({ signal: abortControllerRef.current.signal });

      ndef.onreading = (event: any) => {
        abortControllerRef.current?.abort();
        for (const record of event.message.records) {
          if (record.recordType === "text") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            const text = decoder.decode(record.data);
            const scannedId = text.split("/").pop();
            if (scannedId === checkedId) {
              setVerified((prev) => new Set(prev).add(checkedId));
              setCheckedId(null);
              setScanStatus("match");
              setScanMessage("✓ Verificado correctamente.");
            } else {
              setScanStatus("mismatch");
              setScanMessage("✗ La pulsera no corresponde al invitado seleccionado.");
            }
            return;
          }
        }
        setScanStatus("error");
        setScanMessage("No se pudo leer el ID del tag.");
      };

      ndef.onreadingerror = () => { setScanStatus("error"); setScanMessage("Error al leer el tag."); };
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); }
      else { setScanStatus("error"); setScanMessage(`Error: ${err.message}`); }
    }
  }

  function cancelScan() {
    abortControllerRef.current?.abort();
    setScanStatus("idle");
    setScanMessage("");
  }

  async function startRead() {
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); return; }
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("reading");
      setScanMessage("Acercá la pulsera NFC...");
      setReadGuest(null);

      const ndef = new (window as any).NDEFReader();
      await ndef.scan({ signal: abortControllerRef.current.signal });

      ndef.onreading = (event: any) => {
        abortControllerRef.current?.abort();
        for (const record of event.message.records) {
          if (record.recordType === "text") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            const text = decoder.decode(record.data);
            const scannedId = text.split("/").pop();
            const found = scannedId ? GUESTS.find((g) => g.id === scannedId) ?? null : null;
            setReadGuest(found);
            setScanStatus(found ? "match" : "error");
            setScanMessage(found ? `Leído: ${found.name}` : "ID no encontrado en la lista.");
            return;
          }
        }
        setScanStatus("error");
        setScanMessage("No se pudo leer el ID del tag.");
      };

      ndef.onreadingerror = () => { setScanStatus("error"); setScanMessage("Error al leer el tag."); };
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); }
      else { setScanStatus("error"); setScanMessage(`Error: ${err.message}`); }
    }
  }

  function openWriteModal() {
    if (!checkedId) return;
    setWritingNroPulsera("");
    setShowWriteModal(true);
  }

  async function startWrite() {
    if (!checkedId || !writingNroPulsera.trim()) return;
    if (!isSupported) { setScanStatus("error"); setScanMessage("Web NFC no está soportado."); setShowWriteModal(false); return; }
    setShowWriteModal(false);
    try {
      abortControllerRef.current = new AbortController();
      setScanStatus("writing");
      setScanMessage("Acercá la pulsera NFC para grabar...");

      const ndef = new (window as any).NDEFReader();
      await ndef.write(
        { records: [{ recordType: "text", data: `https://www.androled.com/${checkedId}` }] },
        { signal: abortControllerRef.current.signal }
      );


      const res = await updateGuestNroPulsera(checkedId,  parseInt(writingNroPulsera) );
      console.log("🚀 ~ startWrite ~ res:", res)
      if (res.error) {
        throw (res.error);
      }

      setScanStatus("match");
      setScanMessage(`✓ Grabado correctamente. Pulsera #${writingNroPulsera}`);
      setWritingNroPulsera("");
    } catch (err: any) {
      if (err.name === "AbortError") { setScanStatus("idle"); setScanMessage(""); }
      else { setScanStatus("error"); setScanMessage(`Error al grabar: ${err.message}`); }
    }
  }

  const filteredGuests = search.trim()
    ? GUESTS.filter((g) => {
        const q = normalize(search);
        return normalize(g.name).includes(q) || normalize(g.email).includes(q) || normalize(g.goesWith).includes(q);
      })
    : GUESTS;

  const selectedGuest = checkedId ? GUESTS.find((g) => g.id === checkedId) : null;

  const th: React.CSSProperties = { padding: "0.65rem 0.75rem", textAlign: "left", color: "#6b5ff8", letterSpacing: "0.08em", fontSize: "0.62rem", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "0.55rem 0.75rem", fontSize: "0.8rem", verticalAlign: "middle" };

  const badgeColor = scanStatus === "match" ? { bg: "rgba(34,197,94,0.08)", text: "#16a34a", border: "rgba(34,197,94,0.25)" }
    : scanStatus === "mismatch" || scanStatus === "error" ? { bg: "rgba(239,68,68,0.08)", text: "#dc2626", border: "rgba(239,68,68,0.25)" }
    : { bg: "rgba(107,95,248,0.08)", text: "#6b5ff8", border: "rgba(107,95,248,0.25)" };

  return (
    <main style={{ fontFamily: "'DM Mono','Courier New',monospace", minHeight: "100vh", background: "#fff", color: "#111", display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 1.25rem", gap: "2rem" }}>

      <header style={{ textAlign: "center", marginTop: "1rem" }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.3em", color: "#6b5ff8", textTransform: "uppercase", marginBottom: "0.5rem" }}>NFC · Check-in</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.04em", margin: 0 }}>Verificación Pulseras</h1>
      </header>

      {/* Panel de verificación */}
      <section style={{ width: "100%", maxWidth: "420px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: "16px", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6b5ff8" }}>
          {scanStatus === "scanning" ? "Esperando pulsera..." : "Invitado seleccionado"}
        </div>

        {selectedGuest ? (
          <div style={{ background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: "10px", padding: "0.85rem" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{selectedGuest.name}</div>
            {selectedGuest.email && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.2rem" }}>{selectedGuest.email}</div>}
          </div>
        ) : (
          <div style={{ color: "#bbb", fontSize: "0.82rem" }}>Seleccioná un invitado de la tabla</div>
        )}

        {scanMessage && (
          <div style={{ padding: "0.5rem 1rem", borderRadius: "8px", fontSize: "0.8rem", background: badgeColor.bg, color: badgeColor.text, border: `1px solid ${badgeColor.border}` }}>
            {scanStatus === "scanning" ? "⟳ " : ""}{scanMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={scanStatus === "scanning" ? cancelScan : startVerify}
            disabled={!checkedId && scanStatus !== "scanning"}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "none", background: scanStatus === "scanning" ? "rgba(239,68,68,0.1)" : (!checkedId ? "#f0f0f0" : "#6b5ff8"), color: scanStatus === "scanning" ? "#dc2626" : (!checkedId ? "#aaa" : "#fff"), fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: (!checkedId && scanStatus !== "scanning") ? "not-allowed" : "pointer", transition: "background 0.15s" }}
          >
            {scanStatus === "scanning" ? "Cancelar" : "Verificar con NFC"}
          </button>
          <button
            onClick={scanStatus === "reading" ? cancelScan : startRead}
            disabled={scanStatus === "scanning"}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: scanStatus === "reading" ? "rgba(239,68,68,0.1)" : "#fff", color: scanStatus === "reading" ? "#dc2626" : (scanStatus === "scanning" ? "#aaa" : "#111"), fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: scanStatus === "scanning" ? "not-allowed" : "pointer", transition: "background 0.15s" }}
          >
            {scanStatus === "reading" ? "Cancelar" : "Leer pulsera"}
          </button>
          <button
            onClick={scanStatus === "writing" ? cancelScan : openWriteModal}
            disabled={(!checkedId && scanStatus !== "writing") || scanStatus === "scanning" || scanStatus === "reading"}
            style={{ flex: 1, padding: "0.85rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: scanStatus === "writing" ? "rgba(239,68,68,0.1)" : ((!checkedId || scanStatus === "scanning" || scanStatus === "reading") ? "#f9f9f9" : "#fff"), color: scanStatus === "writing" ? "#dc2626" : ((!checkedId || scanStatus === "scanning" || scanStatus === "reading") ? "#bbb" : "#111"), fontSize: "0.88rem", fontFamily: "inherit", fontWeight: 600, cursor: ((!checkedId && scanStatus !== "writing") || scanStatus === "scanning" || scanStatus === "reading") ? "not-allowed" : "pointer", transition: "background 0.15s" }}
          >
            {scanStatus === "writing" ? "Cancelar" : "Grabar tag"}
          </button>
        </div>

        {readGuest && (
          <div style={{ background: "rgba(107,95,248,0.05)", border: "1px solid rgba(107,95,248,0.15)", borderRadius: "10px", padding: "0.85rem" }}>
            <div style={{ fontSize: "0.62rem", color: "#6b5ff8", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.4rem" }}>Pulsera leída</div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{readGuest.name}</div>
            {readGuest.email && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.2rem" }}>{readGuest.email}</div>}
            {readGuest.goesWith && <div style={{ fontSize: "0.75rem", color: "#888" }}>con {readGuest.goesWith}</div>}
            <div style={{ fontSize: "0.78rem", color: "#444", marginTop: "0.4rem", display: "flex", gap: "1.5rem" }}>
              <span>Mesa: <strong>{readGuest.mesa || "—"}</strong></span>
              <span>Pulsera: <strong>{readGuest.nroPulsera || "—"}</strong></span>
            </div>
          </div>
        )}
      </section>

      {/* Tabla */}
      <section style={{ width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6b5ff8" }}>Lista de invitados</div>

        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, mail o acompañante..." style={{ padding: "0.65rem 0.9rem", borderRadius: "8px", border: "1px solid #e5e5e5", fontFamily: "inherit", fontSize: "0.88rem", color: "#111", background: "#fafafa", outline: "none" }} />

        <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9f9f9", borderBottom: "1px solid #e5e5e5" }}>
                <th style={{ ...th, width: "36px" }}></th>
                <th style={th}>Nombre</th>
                <th style={th}>Mail</th>
                <th style={th}>Con</th>
                <th style={th}>Mesa</th>
                <th style={th}>Pulsera</th>
                <th style={th}>ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((g, i) => {
                const isChecked = checkedId === g.id;
                const isVerified = verified.has(g.id);
                const rowBg = isVerified ? "rgba(34,197,94,0.07)" : isChecked ? "rgba(107,95,248,0.06)" : i % 2 === 0 ? "#fff" : "#fafafa";
                return (
                  <tr
                    key={g.id}
                    onClick={() => { if (scanStatus !== "scanning") setCheckedId(isChecked ? null : g.id); }}
                    style={{ borderBottom: "1px solid #f0f0f0", background: rowBg, cursor: scanStatus === "scanning" ? "default" : "pointer" }}
                  >
                    <td style={{ ...td, textAlign: "center" }}>
                      {isVerified ? (
                        <span style={{ color: "#16a34a", fontSize: "1rem" }}>✓</span>
                      ) : (
                        <span style={{ display: "inline-block", width: "16px", height: "16px", borderRadius: "4px", border: `2px solid ${isChecked ? "#6b5ff8" : "#ddd"}`, background: isChecked ? "#6b5ff8" : "transparent", verticalAlign: "middle" }} />
                      )}
                    </td>
                    <td style={{ ...td, fontWeight: isChecked ? 700 : 400 }}>{g.name}</td>
                    <td style={{ ...td, color: g.email ? "#555" : "#ccc", fontSize: "0.72rem" }}>{g.email || "—"}</td>
                    <td style={{ ...td, color: g.goesWith ? "#555" : "#ccc" }}>{g.goesWith || "—"}</td>
                    <td style={{ ...td, color: g.mesa ? "#111" : "#ccc" }}>{g.mesa || "—"}</td>
                    <td style={{ ...td, color: g.nroPulsera ? "#111" : "#ccc" }}>{g.nroPulsera || "—"}</td>
                    <td style={{ ...td, color: "#bbb", fontSize: "0.65rem" }}>{g.id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: "0.7rem", color: "#bbb", textAlign: "right" }}>{filteredGuests.length} invitados · {verified.size} verificados</div>
      </section>

      <footer style={{ fontSize: "0.65rem", color: "#bbb", textAlign: "center", paddingBottom: "1rem" }}>
        Requiere Chrome para Android · HTTPS
      </footer>

      {/* Modal nro de pulsera */}
      {showWriteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1.5rem" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "1.75rem", width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column", gap: "1rem", fontFamily: "'DM Mono','Courier New',monospace" }}>
            <div style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#6b5ff8" }}>Grabar tag NFC</div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{GUESTS.find(g => g.id === checkedId)?.name}</div>
            <label style={{ fontSize: "0.8rem", color: "#555" }}>
              Número de pulsera
              <input
                autoFocus
                value={writingNroPulsera}
                onChange={(e) => setWritingNroPulsera(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && writingNroPulsera.trim()) startWrite(); }}
                placeholder="Ej: 42"
                style={{ display: "block", marginTop: "0.4rem", width: "100%", padding: "0.7rem 0.9rem", borderRadius: "8px", border: "1px solid #e5e5e5", fontFamily: "inherit", fontSize: "0.9rem", color: "#111", background: "#fafafa", outline: "none", boxSizing: "border-box" }}
              />
            </label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setShowWriteModal(false)} style={{ flex: 1, padding: "0.75rem", borderRadius: "10px", border: "1px solid #e5e5e5", background: "#fff", color: "#111", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={startWrite}
                disabled={!writingNroPulsera.trim()}
                style={{ flex: 1, padding: "0.75rem", borderRadius: "10px", border: "none", background: writingNroPulsera.trim() ? "#6b5ff8" : "#f0f0f0", color: writingNroPulsera.trim() ? "#fff" : "#aaa", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: writingNroPulsera.trim() ? "pointer" : "not-allowed" }}
              >
                Grabar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}