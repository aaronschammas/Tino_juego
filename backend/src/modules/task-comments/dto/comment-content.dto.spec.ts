import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CommentContentDto } from './comment-content.dto';

describe('CommentContentDto', () => {
  it('trims valid content', async () => {
    const dto = plainToInstance(CommentContentDto, { content: '  avance  ' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.content).toBe('avance');
  });
  it.each(['', '   '])('rejects empty content', async (content) => {
    expect(
      await validate(plainToInstance(CommentContentDto, { content })),
    ).not.toHaveLength(0);
  });
  it('rejects content longer than 2000 characters', async () => {
    expect(
      await validate(
        plainToInstance(CommentContentDto, { content: 'a'.repeat(2001) }),
      ),
    ).not.toHaveLength(0);
  });
});
