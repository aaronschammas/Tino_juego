
// Pagina para traducir errores :)
import { translateErrorMessage } from './errorMessages';

describe('translateErrorMessage - Backend Error Translation', () => {
  it('should translate a known task permission error to Spanish', () => {
    
    const message = 'Members can only change task status or take unassigned tasks';

    
    const result = translateErrorMessage(message, 'fallback');

   
    expect(result).toBe('Los miembros solo pueden cambiar el estado o tomar tareas no asignadas.');
  });

  it('should translate a known project ownership error to Spanish', () => {
   
    const message = 'Only project owner can update the project';

    const result = translateErrorMessage(message, 'fallback');

   
    expect(result).toBe('Solo el propietario del proyecto puede editarlo.');
  });

  it('should translate a known member-projects permission error to Spanish', () => {
    
    const message = 'Only organization owners can update member projects';

    
    const result = translateErrorMessage(message, 'fallback');

    
    expect(result).toBe('Solo los propietarios pueden actualizar proyectos de miembros.');
  });

  it('should return the original message when there is no known translation', () => {
    
    const message = 'Some brand-new backend error message';

  
    const result = translateErrorMessage(message, 'fallback');

   
    expect(result).toBe('Some brand-new backend error message');
  });

  it('should return the fallback when the message is empty', () => {
   
    const message = '';

   
    const result = translateErrorMessage(message, 'Error al guardar');

   
    expect(result).toBe('Error al guardar');
  });

  it('should return the fallback when the message is null or undefined', () => {
   
    const resultNull = translateErrorMessage(null, 'Error al guardar');
    const resultUndefined = translateErrorMessage(undefined, 'Error al guardar');

    
    expect(resultNull).toBe('Error al guardar');
    expect(resultUndefined).toBe('Error al guardar');
  });

  it('should trim whitespace before matching a translation', () => {

    const message = '  Project not found  ';

   
    const result = translateErrorMessage(message, 'fallback');

   
    expect(result).toBe('Proyecto no encontrado.');
  });
});
