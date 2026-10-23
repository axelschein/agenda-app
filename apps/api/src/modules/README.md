# Organización de módulos y clases

Cada módulo es dueño de sus clases de dominio. Cuando se incorpore una clase, se ubica en `apps/api/src/modules/<módulo>/domain/`; por ejemplo, `Reservation` en `reservations/domain/` y `Service` en `services/domain/`.

Los controladores traducen HTTP a operaciones de aplicación. Las reglas y el estado del negocio viven en las clases del dominio; los detalles de persistencia quedan detrás de adaptadores del módulo. Los contratos de `packages/shared` describen los datos que cruzan la API y no sustituyen a las entidades internas.

Las carpetas `domain/` se completarán con las clases que surjan de los casos de uso y del modelo acordado, evitando crear entidades o reglas antes de definirlas.
