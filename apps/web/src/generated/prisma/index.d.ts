
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Book
 * 
 */
export type Book = $Result.DefaultSelection<Prisma.$BookPayload>
/**
 * Model CharacterProfile
 * 
 */
export type CharacterProfile = $Result.DefaultSelection<Prisma.$CharacterProfilePayload>
/**
 * Model CharacterAlias
 * 
 */
export type CharacterAlias = $Result.DefaultSelection<Prisma.$CharacterAliasPayload>
/**
 * Model TTSVoiceProfile
 * 
 */
export type TTSVoiceProfile = $Result.DefaultSelection<Prisma.$TTSVoiceProfilePayload>
/**
 * Model CharacterVoiceBinding
 * 
 */
export type CharacterVoiceBinding = $Result.DefaultSelection<Prisma.$CharacterVoiceBindingPayload>
/**
 * Model TextSegment
 * 
 */
export type TextSegment = $Result.DefaultSelection<Prisma.$TextSegmentPayload>
/**
 * Model ScriptSentence
 * 
 */
export type ScriptSentence = $Result.DefaultSelection<Prisma.$ScriptSentencePayload>
/**
 * Model AudioFile
 * 
 */
export type AudioFile = $Result.DefaultSelection<Prisma.$AudioFilePayload>
/**
 * Model CharacterMergeAudit
 * 
 */
export type CharacterMergeAudit = $Result.DefaultSelection<Prisma.$CharacterMergeAuditPayload>
/**
 * Model ProcessingTask
 * 
 */
export type ProcessingTask = $Result.DefaultSelection<Prisma.$ProcessingTaskPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Books
 * const books = await prisma.book.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Books
   * const books = await prisma.book.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.book`: Exposes CRUD operations for the **Book** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Books
    * const books = await prisma.book.findMany()
    * ```
    */
  get book(): Prisma.BookDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.characterProfile`: Exposes CRUD operations for the **CharacterProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CharacterProfiles
    * const characterProfiles = await prisma.characterProfile.findMany()
    * ```
    */
  get characterProfile(): Prisma.CharacterProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.characterAlias`: Exposes CRUD operations for the **CharacterAlias** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CharacterAliases
    * const characterAliases = await prisma.characterAlias.findMany()
    * ```
    */
  get characterAlias(): Prisma.CharacterAliasDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.tTSVoiceProfile`: Exposes CRUD operations for the **TTSVoiceProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TTSVoiceProfiles
    * const tTSVoiceProfiles = await prisma.tTSVoiceProfile.findMany()
    * ```
    */
  get tTSVoiceProfile(): Prisma.TTSVoiceProfileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.characterVoiceBinding`: Exposes CRUD operations for the **CharacterVoiceBinding** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CharacterVoiceBindings
    * const characterVoiceBindings = await prisma.characterVoiceBinding.findMany()
    * ```
    */
  get characterVoiceBinding(): Prisma.CharacterVoiceBindingDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.textSegment`: Exposes CRUD operations for the **TextSegment** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TextSegments
    * const textSegments = await prisma.textSegment.findMany()
    * ```
    */
  get textSegment(): Prisma.TextSegmentDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.scriptSentence`: Exposes CRUD operations for the **ScriptSentence** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ScriptSentences
    * const scriptSentences = await prisma.scriptSentence.findMany()
    * ```
    */
  get scriptSentence(): Prisma.ScriptSentenceDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.audioFile`: Exposes CRUD operations for the **AudioFile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AudioFiles
    * const audioFiles = await prisma.audioFile.findMany()
    * ```
    */
  get audioFile(): Prisma.AudioFileDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.characterMergeAudit`: Exposes CRUD operations for the **CharacterMergeAudit** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CharacterMergeAudits
    * const characterMergeAudits = await prisma.characterMergeAudit.findMany()
    * ```
    */
  get characterMergeAudit(): Prisma.CharacterMergeAuditDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.processingTask`: Exposes CRUD operations for the **ProcessingTask** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ProcessingTasks
    * const processingTasks = await prisma.processingTask.findMany()
    * ```
    */
  get processingTask(): Prisma.ProcessingTaskDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.0
   * Query Engine version: 2ba551f319ab1df4bc874a89965d8b3641056773
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Book: 'Book',
    CharacterProfile: 'CharacterProfile',
    CharacterAlias: 'CharacterAlias',
    TTSVoiceProfile: 'TTSVoiceProfile',
    CharacterVoiceBinding: 'CharacterVoiceBinding',
    TextSegment: 'TextSegment',
    ScriptSentence: 'ScriptSentence',
    AudioFile: 'AudioFile',
    CharacterMergeAudit: 'CharacterMergeAudit',
    ProcessingTask: 'ProcessingTask'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "book" | "characterProfile" | "characterAlias" | "tTSVoiceProfile" | "characterVoiceBinding" | "textSegment" | "scriptSentence" | "audioFile" | "characterMergeAudit" | "processingTask"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Book: {
        payload: Prisma.$BookPayload<ExtArgs>
        fields: Prisma.BookFieldRefs
        operations: {
          findUnique: {
            args: Prisma.BookFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.BookFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>
          }
          findFirst: {
            args: Prisma.BookFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.BookFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>
          }
          findMany: {
            args: Prisma.BookFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>[]
          }
          create: {
            args: Prisma.BookCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>
          }
          createMany: {
            args: Prisma.BookCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.BookCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>[]
          }
          delete: {
            args: Prisma.BookDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>
          }
          update: {
            args: Prisma.BookUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>
          }
          deleteMany: {
            args: Prisma.BookDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.BookUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.BookUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>[]
          }
          upsert: {
            args: Prisma.BookUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BookPayload>
          }
          aggregate: {
            args: Prisma.BookAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBook>
          }
          groupBy: {
            args: Prisma.BookGroupByArgs<ExtArgs>
            result: $Utils.Optional<BookGroupByOutputType>[]
          }
          count: {
            args: Prisma.BookCountArgs<ExtArgs>
            result: $Utils.Optional<BookCountAggregateOutputType> | number
          }
        }
      }
      CharacterProfile: {
        payload: Prisma.$CharacterProfilePayload<ExtArgs>
        fields: Prisma.CharacterProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CharacterProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CharacterProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>
          }
          findFirst: {
            args: Prisma.CharacterProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CharacterProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>
          }
          findMany: {
            args: Prisma.CharacterProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>[]
          }
          create: {
            args: Prisma.CharacterProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>
          }
          createMany: {
            args: Prisma.CharacterProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CharacterProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>[]
          }
          delete: {
            args: Prisma.CharacterProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>
          }
          update: {
            args: Prisma.CharacterProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>
          }
          deleteMany: {
            args: Prisma.CharacterProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CharacterProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CharacterProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>[]
          }
          upsert: {
            args: Prisma.CharacterProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterProfilePayload>
          }
          aggregate: {
            args: Prisma.CharacterProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCharacterProfile>
          }
          groupBy: {
            args: Prisma.CharacterProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<CharacterProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.CharacterProfileCountArgs<ExtArgs>
            result: $Utils.Optional<CharacterProfileCountAggregateOutputType> | number
          }
        }
      }
      CharacterAlias: {
        payload: Prisma.$CharacterAliasPayload<ExtArgs>
        fields: Prisma.CharacterAliasFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CharacterAliasFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CharacterAliasFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>
          }
          findFirst: {
            args: Prisma.CharacterAliasFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CharacterAliasFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>
          }
          findMany: {
            args: Prisma.CharacterAliasFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>[]
          }
          create: {
            args: Prisma.CharacterAliasCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>
          }
          createMany: {
            args: Prisma.CharacterAliasCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CharacterAliasCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>[]
          }
          delete: {
            args: Prisma.CharacterAliasDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>
          }
          update: {
            args: Prisma.CharacterAliasUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>
          }
          deleteMany: {
            args: Prisma.CharacterAliasDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CharacterAliasUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CharacterAliasUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>[]
          }
          upsert: {
            args: Prisma.CharacterAliasUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterAliasPayload>
          }
          aggregate: {
            args: Prisma.CharacterAliasAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCharacterAlias>
          }
          groupBy: {
            args: Prisma.CharacterAliasGroupByArgs<ExtArgs>
            result: $Utils.Optional<CharacterAliasGroupByOutputType>[]
          }
          count: {
            args: Prisma.CharacterAliasCountArgs<ExtArgs>
            result: $Utils.Optional<CharacterAliasCountAggregateOutputType> | number
          }
        }
      }
      TTSVoiceProfile: {
        payload: Prisma.$TTSVoiceProfilePayload<ExtArgs>
        fields: Prisma.TTSVoiceProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TTSVoiceProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TTSVoiceProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>
          }
          findFirst: {
            args: Prisma.TTSVoiceProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TTSVoiceProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>
          }
          findMany: {
            args: Prisma.TTSVoiceProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>[]
          }
          create: {
            args: Prisma.TTSVoiceProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>
          }
          createMany: {
            args: Prisma.TTSVoiceProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TTSVoiceProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>[]
          }
          delete: {
            args: Prisma.TTSVoiceProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>
          }
          update: {
            args: Prisma.TTSVoiceProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>
          }
          deleteMany: {
            args: Prisma.TTSVoiceProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TTSVoiceProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TTSVoiceProfileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>[]
          }
          upsert: {
            args: Prisma.TTSVoiceProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TTSVoiceProfilePayload>
          }
          aggregate: {
            args: Prisma.TTSVoiceProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTTSVoiceProfile>
          }
          groupBy: {
            args: Prisma.TTSVoiceProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<TTSVoiceProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.TTSVoiceProfileCountArgs<ExtArgs>
            result: $Utils.Optional<TTSVoiceProfileCountAggregateOutputType> | number
          }
        }
      }
      CharacterVoiceBinding: {
        payload: Prisma.$CharacterVoiceBindingPayload<ExtArgs>
        fields: Prisma.CharacterVoiceBindingFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CharacterVoiceBindingFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CharacterVoiceBindingFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>
          }
          findFirst: {
            args: Prisma.CharacterVoiceBindingFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CharacterVoiceBindingFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>
          }
          findMany: {
            args: Prisma.CharacterVoiceBindingFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>[]
          }
          create: {
            args: Prisma.CharacterVoiceBindingCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>
          }
          createMany: {
            args: Prisma.CharacterVoiceBindingCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CharacterVoiceBindingCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>[]
          }
          delete: {
            args: Prisma.CharacterVoiceBindingDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>
          }
          update: {
            args: Prisma.CharacterVoiceBindingUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>
          }
          deleteMany: {
            args: Prisma.CharacterVoiceBindingDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CharacterVoiceBindingUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CharacterVoiceBindingUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>[]
          }
          upsert: {
            args: Prisma.CharacterVoiceBindingUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterVoiceBindingPayload>
          }
          aggregate: {
            args: Prisma.CharacterVoiceBindingAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCharacterVoiceBinding>
          }
          groupBy: {
            args: Prisma.CharacterVoiceBindingGroupByArgs<ExtArgs>
            result: $Utils.Optional<CharacterVoiceBindingGroupByOutputType>[]
          }
          count: {
            args: Prisma.CharacterVoiceBindingCountArgs<ExtArgs>
            result: $Utils.Optional<CharacterVoiceBindingCountAggregateOutputType> | number
          }
        }
      }
      TextSegment: {
        payload: Prisma.$TextSegmentPayload<ExtArgs>
        fields: Prisma.TextSegmentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TextSegmentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TextSegmentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>
          }
          findFirst: {
            args: Prisma.TextSegmentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TextSegmentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>
          }
          findMany: {
            args: Prisma.TextSegmentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>[]
          }
          create: {
            args: Prisma.TextSegmentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>
          }
          createMany: {
            args: Prisma.TextSegmentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TextSegmentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>[]
          }
          delete: {
            args: Prisma.TextSegmentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>
          }
          update: {
            args: Prisma.TextSegmentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>
          }
          deleteMany: {
            args: Prisma.TextSegmentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TextSegmentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TextSegmentUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>[]
          }
          upsert: {
            args: Prisma.TextSegmentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TextSegmentPayload>
          }
          aggregate: {
            args: Prisma.TextSegmentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTextSegment>
          }
          groupBy: {
            args: Prisma.TextSegmentGroupByArgs<ExtArgs>
            result: $Utils.Optional<TextSegmentGroupByOutputType>[]
          }
          count: {
            args: Prisma.TextSegmentCountArgs<ExtArgs>
            result: $Utils.Optional<TextSegmentCountAggregateOutputType> | number
          }
        }
      }
      ScriptSentence: {
        payload: Prisma.$ScriptSentencePayload<ExtArgs>
        fields: Prisma.ScriptSentenceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ScriptSentenceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ScriptSentenceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>
          }
          findFirst: {
            args: Prisma.ScriptSentenceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ScriptSentenceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>
          }
          findMany: {
            args: Prisma.ScriptSentenceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>[]
          }
          create: {
            args: Prisma.ScriptSentenceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>
          }
          createMany: {
            args: Prisma.ScriptSentenceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ScriptSentenceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>[]
          }
          delete: {
            args: Prisma.ScriptSentenceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>
          }
          update: {
            args: Prisma.ScriptSentenceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>
          }
          deleteMany: {
            args: Prisma.ScriptSentenceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ScriptSentenceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ScriptSentenceUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>[]
          }
          upsert: {
            args: Prisma.ScriptSentenceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ScriptSentencePayload>
          }
          aggregate: {
            args: Prisma.ScriptSentenceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateScriptSentence>
          }
          groupBy: {
            args: Prisma.ScriptSentenceGroupByArgs<ExtArgs>
            result: $Utils.Optional<ScriptSentenceGroupByOutputType>[]
          }
          count: {
            args: Prisma.ScriptSentenceCountArgs<ExtArgs>
            result: $Utils.Optional<ScriptSentenceCountAggregateOutputType> | number
          }
        }
      }
      AudioFile: {
        payload: Prisma.$AudioFilePayload<ExtArgs>
        fields: Prisma.AudioFileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AudioFileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AudioFileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>
          }
          findFirst: {
            args: Prisma.AudioFileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AudioFileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>
          }
          findMany: {
            args: Prisma.AudioFileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>[]
          }
          create: {
            args: Prisma.AudioFileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>
          }
          createMany: {
            args: Prisma.AudioFileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AudioFileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>[]
          }
          delete: {
            args: Prisma.AudioFileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>
          }
          update: {
            args: Prisma.AudioFileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>
          }
          deleteMany: {
            args: Prisma.AudioFileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AudioFileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.AudioFileUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>[]
          }
          upsert: {
            args: Prisma.AudioFileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AudioFilePayload>
          }
          aggregate: {
            args: Prisma.AudioFileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAudioFile>
          }
          groupBy: {
            args: Prisma.AudioFileGroupByArgs<ExtArgs>
            result: $Utils.Optional<AudioFileGroupByOutputType>[]
          }
          count: {
            args: Prisma.AudioFileCountArgs<ExtArgs>
            result: $Utils.Optional<AudioFileCountAggregateOutputType> | number
          }
        }
      }
      CharacterMergeAudit: {
        payload: Prisma.$CharacterMergeAuditPayload<ExtArgs>
        fields: Prisma.CharacterMergeAuditFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CharacterMergeAuditFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CharacterMergeAuditFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>
          }
          findFirst: {
            args: Prisma.CharacterMergeAuditFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CharacterMergeAuditFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>
          }
          findMany: {
            args: Prisma.CharacterMergeAuditFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>[]
          }
          create: {
            args: Prisma.CharacterMergeAuditCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>
          }
          createMany: {
            args: Prisma.CharacterMergeAuditCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CharacterMergeAuditCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>[]
          }
          delete: {
            args: Prisma.CharacterMergeAuditDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>
          }
          update: {
            args: Prisma.CharacterMergeAuditUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>
          }
          deleteMany: {
            args: Prisma.CharacterMergeAuditDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CharacterMergeAuditUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CharacterMergeAuditUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>[]
          }
          upsert: {
            args: Prisma.CharacterMergeAuditUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CharacterMergeAuditPayload>
          }
          aggregate: {
            args: Prisma.CharacterMergeAuditAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCharacterMergeAudit>
          }
          groupBy: {
            args: Prisma.CharacterMergeAuditGroupByArgs<ExtArgs>
            result: $Utils.Optional<CharacterMergeAuditGroupByOutputType>[]
          }
          count: {
            args: Prisma.CharacterMergeAuditCountArgs<ExtArgs>
            result: $Utils.Optional<CharacterMergeAuditCountAggregateOutputType> | number
          }
        }
      }
      ProcessingTask: {
        payload: Prisma.$ProcessingTaskPayload<ExtArgs>
        fields: Prisma.ProcessingTaskFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ProcessingTaskFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ProcessingTaskFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>
          }
          findFirst: {
            args: Prisma.ProcessingTaskFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ProcessingTaskFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>
          }
          findMany: {
            args: Prisma.ProcessingTaskFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>[]
          }
          create: {
            args: Prisma.ProcessingTaskCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>
          }
          createMany: {
            args: Prisma.ProcessingTaskCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ProcessingTaskCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>[]
          }
          delete: {
            args: Prisma.ProcessingTaskDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>
          }
          update: {
            args: Prisma.ProcessingTaskUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>
          }
          deleteMany: {
            args: Prisma.ProcessingTaskDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ProcessingTaskUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ProcessingTaskUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>[]
          }
          upsert: {
            args: Prisma.ProcessingTaskUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProcessingTaskPayload>
          }
          aggregate: {
            args: Prisma.ProcessingTaskAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateProcessingTask>
          }
          groupBy: {
            args: Prisma.ProcessingTaskGroupByArgs<ExtArgs>
            result: $Utils.Optional<ProcessingTaskGroupByOutputType>[]
          }
          count: {
            args: Prisma.ProcessingTaskCountArgs<ExtArgs>
            result: $Utils.Optional<ProcessingTaskCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    book?: BookOmit
    characterProfile?: CharacterProfileOmit
    characterAlias?: CharacterAliasOmit
    tTSVoiceProfile?: TTSVoiceProfileOmit
    characterVoiceBinding?: CharacterVoiceBindingOmit
    textSegment?: TextSegmentOmit
    scriptSentence?: ScriptSentenceOmit
    audioFile?: AudioFileOmit
    characterMergeAudit?: CharacterMergeAuditOmit
    processingTask?: ProcessingTaskOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type BookCountOutputType
   */

  export type BookCountOutputType = {
    audioFiles: number
    mergeAudits: number
    characterProfiles: number
    processingTasks: number
    scriptSentences: number
    textSegments: number
  }

  export type BookCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | BookCountOutputTypeCountAudioFilesArgs
    mergeAudits?: boolean | BookCountOutputTypeCountMergeAuditsArgs
    characterProfiles?: boolean | BookCountOutputTypeCountCharacterProfilesArgs
    processingTasks?: boolean | BookCountOutputTypeCountProcessingTasksArgs
    scriptSentences?: boolean | BookCountOutputTypeCountScriptSentencesArgs
    textSegments?: boolean | BookCountOutputTypeCountTextSegmentsArgs
  }

  // Custom InputTypes
  /**
   * BookCountOutputType without action
   */
  export type BookCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the BookCountOutputType
     */
    select?: BookCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * BookCountOutputType without action
   */
  export type BookCountOutputTypeCountAudioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AudioFileWhereInput
  }

  /**
   * BookCountOutputType without action
   */
  export type BookCountOutputTypeCountMergeAuditsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterMergeAuditWhereInput
  }

  /**
   * BookCountOutputType without action
   */
  export type BookCountOutputTypeCountCharacterProfilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterProfileWhereInput
  }

  /**
   * BookCountOutputType without action
   */
  export type BookCountOutputTypeCountProcessingTasksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProcessingTaskWhereInput
  }

  /**
   * BookCountOutputType without action
   */
  export type BookCountOutputTypeCountScriptSentencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ScriptSentenceWhereInput
  }

  /**
   * BookCountOutputType without action
   */
  export type BookCountOutputTypeCountTextSegmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TextSegmentWhereInput
  }


  /**
   * Count Type CharacterProfileCountOutputType
   */

  export type CharacterProfileCountOutputType = {
    aliases: number
    mergeAuditsSource: number
    mergeAuditsTarget: number
    voiceBindings: number
    scriptSentences: number
  }

  export type CharacterProfileCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    aliases?: boolean | CharacterProfileCountOutputTypeCountAliasesArgs
    mergeAuditsSource?: boolean | CharacterProfileCountOutputTypeCountMergeAuditsSourceArgs
    mergeAuditsTarget?: boolean | CharacterProfileCountOutputTypeCountMergeAuditsTargetArgs
    voiceBindings?: boolean | CharacterProfileCountOutputTypeCountVoiceBindingsArgs
    scriptSentences?: boolean | CharacterProfileCountOutputTypeCountScriptSentencesArgs
  }

  // Custom InputTypes
  /**
   * CharacterProfileCountOutputType without action
   */
  export type CharacterProfileCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfileCountOutputType
     */
    select?: CharacterProfileCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CharacterProfileCountOutputType without action
   */
  export type CharacterProfileCountOutputTypeCountAliasesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterAliasWhereInput
  }

  /**
   * CharacterProfileCountOutputType without action
   */
  export type CharacterProfileCountOutputTypeCountMergeAuditsSourceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterMergeAuditWhereInput
  }

  /**
   * CharacterProfileCountOutputType without action
   */
  export type CharacterProfileCountOutputTypeCountMergeAuditsTargetArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterMergeAuditWhereInput
  }

  /**
   * CharacterProfileCountOutputType without action
   */
  export type CharacterProfileCountOutputTypeCountVoiceBindingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterVoiceBindingWhereInput
  }

  /**
   * CharacterProfileCountOutputType without action
   */
  export type CharacterProfileCountOutputTypeCountScriptSentencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ScriptSentenceWhereInput
  }


  /**
   * Count Type TTSVoiceProfileCountOutputType
   */

  export type TTSVoiceProfileCountOutputType = {
    audioFiles: number
    voiceBindings: number
  }

  export type TTSVoiceProfileCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | TTSVoiceProfileCountOutputTypeCountAudioFilesArgs
    voiceBindings?: boolean | TTSVoiceProfileCountOutputTypeCountVoiceBindingsArgs
  }

  // Custom InputTypes
  /**
   * TTSVoiceProfileCountOutputType without action
   */
  export type TTSVoiceProfileCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfileCountOutputType
     */
    select?: TTSVoiceProfileCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TTSVoiceProfileCountOutputType without action
   */
  export type TTSVoiceProfileCountOutputTypeCountAudioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AudioFileWhereInput
  }

  /**
   * TTSVoiceProfileCountOutputType without action
   */
  export type TTSVoiceProfileCountOutputTypeCountVoiceBindingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterVoiceBindingWhereInput
  }


  /**
   * Count Type TextSegmentCountOutputType
   */

  export type TextSegmentCountOutputType = {
    audioFiles: number
    scriptSentences: number
  }

  export type TextSegmentCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | TextSegmentCountOutputTypeCountAudioFilesArgs
    scriptSentences?: boolean | TextSegmentCountOutputTypeCountScriptSentencesArgs
  }

  // Custom InputTypes
  /**
   * TextSegmentCountOutputType without action
   */
  export type TextSegmentCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegmentCountOutputType
     */
    select?: TextSegmentCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TextSegmentCountOutputType without action
   */
  export type TextSegmentCountOutputTypeCountAudioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AudioFileWhereInput
  }

  /**
   * TextSegmentCountOutputType without action
   */
  export type TextSegmentCountOutputTypeCountScriptSentencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ScriptSentenceWhereInput
  }


  /**
   * Count Type ScriptSentenceCountOutputType
   */

  export type ScriptSentenceCountOutputType = {
    audioFiles: number
  }

  export type ScriptSentenceCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | ScriptSentenceCountOutputTypeCountAudioFilesArgs
  }

  // Custom InputTypes
  /**
   * ScriptSentenceCountOutputType without action
   */
  export type ScriptSentenceCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentenceCountOutputType
     */
    select?: ScriptSentenceCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ScriptSentenceCountOutputType without action
   */
  export type ScriptSentenceCountOutputTypeCountAudioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AudioFileWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Book
   */

  export type AggregateBook = {
    _count: BookCountAggregateOutputType | null
    _avg: BookAvgAggregateOutputType | null
    _sum: BookSumAggregateOutputType | null
    _min: BookMinAggregateOutputType | null
    _max: BookMaxAggregateOutputType | null
  }

  export type BookAvgAggregateOutputType = {
    fileSize: number | null
    totalWords: number | null
    totalCharacters: number | null
    totalSegments: number | null
  }

  export type BookSumAggregateOutputType = {
    fileSize: bigint | null
    totalWords: number | null
    totalCharacters: number | null
    totalSegments: number | null
  }

  export type BookMinAggregateOutputType = {
    id: string | null
    title: string | null
    author: string | null
    originalFilename: string | null
    uploadedFilePath: string | null
    fileSize: bigint | null
    totalWords: number | null
    totalCharacters: number | null
    totalSegments: number | null
    encoding: string | null
    fileFormat: string | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BookMaxAggregateOutputType = {
    id: string | null
    title: string | null
    author: string | null
    originalFilename: string | null
    uploadedFilePath: string | null
    fileSize: bigint | null
    totalWords: number | null
    totalCharacters: number | null
    totalSegments: number | null
    encoding: string | null
    fileFormat: string | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BookCountAggregateOutputType = {
    id: number
    title: number
    author: number
    originalFilename: number
    uploadedFilePath: number
    fileSize: number
    totalWords: number
    totalCharacters: number
    totalSegments: number
    encoding: number
    fileFormat: number
    status: number
    metadata: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type BookAvgAggregateInputType = {
    fileSize?: true
    totalWords?: true
    totalCharacters?: true
    totalSegments?: true
  }

  export type BookSumAggregateInputType = {
    fileSize?: true
    totalWords?: true
    totalCharacters?: true
    totalSegments?: true
  }

  export type BookMinAggregateInputType = {
    id?: true
    title?: true
    author?: true
    originalFilename?: true
    uploadedFilePath?: true
    fileSize?: true
    totalWords?: true
    totalCharacters?: true
    totalSegments?: true
    encoding?: true
    fileFormat?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BookMaxAggregateInputType = {
    id?: true
    title?: true
    author?: true
    originalFilename?: true
    uploadedFilePath?: true
    fileSize?: true
    totalWords?: true
    totalCharacters?: true
    totalSegments?: true
    encoding?: true
    fileFormat?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BookCountAggregateInputType = {
    id?: true
    title?: true
    author?: true
    originalFilename?: true
    uploadedFilePath?: true
    fileSize?: true
    totalWords?: true
    totalCharacters?: true
    totalSegments?: true
    encoding?: true
    fileFormat?: true
    status?: true
    metadata?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type BookAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Book to aggregate.
     */
    where?: BookWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Books to fetch.
     */
    orderBy?: BookOrderByWithRelationInput | BookOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: BookWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Books from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Books.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Books
    **/
    _count?: true | BookCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: BookAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: BookSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: BookMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: BookMaxAggregateInputType
  }

  export type GetBookAggregateType<T extends BookAggregateArgs> = {
        [P in keyof T & keyof AggregateBook]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBook[P]>
      : GetScalarType<T[P], AggregateBook[P]>
  }




  export type BookGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BookWhereInput
    orderBy?: BookOrderByWithAggregationInput | BookOrderByWithAggregationInput[]
    by: BookScalarFieldEnum[] | BookScalarFieldEnum
    having?: BookScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: BookCountAggregateInputType | true
    _avg?: BookAvgAggregateInputType
    _sum?: BookSumAggregateInputType
    _min?: BookMinAggregateInputType
    _max?: BookMaxAggregateInputType
  }

  export type BookGroupByOutputType = {
    id: string
    title: string
    author: string | null
    originalFilename: string | null
    uploadedFilePath: string | null
    fileSize: bigint | null
    totalWords: number | null
    totalCharacters: number
    totalSegments: number
    encoding: string | null
    fileFormat: string | null
    status: string
    metadata: JsonValue
    createdAt: Date
    updatedAt: Date
    _count: BookCountAggregateOutputType | null
    _avg: BookAvgAggregateOutputType | null
    _sum: BookSumAggregateOutputType | null
    _min: BookMinAggregateOutputType | null
    _max: BookMaxAggregateOutputType | null
  }

  type GetBookGroupByPayload<T extends BookGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<BookGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof BookGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BookGroupByOutputType[P]>
            : GetScalarType<T[P], BookGroupByOutputType[P]>
        }
      >
    >


  export type BookSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    author?: boolean
    originalFilename?: boolean
    uploadedFilePath?: boolean
    fileSize?: boolean
    totalWords?: boolean
    totalCharacters?: boolean
    totalSegments?: boolean
    encoding?: boolean
    fileFormat?: boolean
    status?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    audioFiles?: boolean | Book$audioFilesArgs<ExtArgs>
    mergeAudits?: boolean | Book$mergeAuditsArgs<ExtArgs>
    characterProfiles?: boolean | Book$characterProfilesArgs<ExtArgs>
    processingTasks?: boolean | Book$processingTasksArgs<ExtArgs>
    scriptSentences?: boolean | Book$scriptSentencesArgs<ExtArgs>
    textSegments?: boolean | Book$textSegmentsArgs<ExtArgs>
    _count?: boolean | BookCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["book"]>

  export type BookSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    author?: boolean
    originalFilename?: boolean
    uploadedFilePath?: boolean
    fileSize?: boolean
    totalWords?: boolean
    totalCharacters?: boolean
    totalSegments?: boolean
    encoding?: boolean
    fileFormat?: boolean
    status?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["book"]>

  export type BookSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    title?: boolean
    author?: boolean
    originalFilename?: boolean
    uploadedFilePath?: boolean
    fileSize?: boolean
    totalWords?: boolean
    totalCharacters?: boolean
    totalSegments?: boolean
    encoding?: boolean
    fileFormat?: boolean
    status?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["book"]>

  export type BookSelectScalar = {
    id?: boolean
    title?: boolean
    author?: boolean
    originalFilename?: boolean
    uploadedFilePath?: boolean
    fileSize?: boolean
    totalWords?: boolean
    totalCharacters?: boolean
    totalSegments?: boolean
    encoding?: boolean
    fileFormat?: boolean
    status?: boolean
    metadata?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type BookOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "title" | "author" | "originalFilename" | "uploadedFilePath" | "fileSize" | "totalWords" | "totalCharacters" | "totalSegments" | "encoding" | "fileFormat" | "status" | "metadata" | "createdAt" | "updatedAt", ExtArgs["result"]["book"]>
  export type BookInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | Book$audioFilesArgs<ExtArgs>
    mergeAudits?: boolean | Book$mergeAuditsArgs<ExtArgs>
    characterProfiles?: boolean | Book$characterProfilesArgs<ExtArgs>
    processingTasks?: boolean | Book$processingTasksArgs<ExtArgs>
    scriptSentences?: boolean | Book$scriptSentencesArgs<ExtArgs>
    textSegments?: boolean | Book$textSegmentsArgs<ExtArgs>
    _count?: boolean | BookCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type BookIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type BookIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $BookPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Book"
    objects: {
      audioFiles: Prisma.$AudioFilePayload<ExtArgs>[]
      mergeAudits: Prisma.$CharacterMergeAuditPayload<ExtArgs>[]
      characterProfiles: Prisma.$CharacterProfilePayload<ExtArgs>[]
      processingTasks: Prisma.$ProcessingTaskPayload<ExtArgs>[]
      scriptSentences: Prisma.$ScriptSentencePayload<ExtArgs>[]
      textSegments: Prisma.$TextSegmentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      title: string
      author: string | null
      originalFilename: string | null
      uploadedFilePath: string | null
      fileSize: bigint | null
      totalWords: number | null
      totalCharacters: number
      totalSegments: number
      encoding: string | null
      fileFormat: string | null
      status: string
      metadata: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["book"]>
    composites: {}
  }

  type BookGetPayload<S extends boolean | null | undefined | BookDefaultArgs> = $Result.GetResult<Prisma.$BookPayload, S>

  type BookCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<BookFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: BookCountAggregateInputType | true
    }

  export interface BookDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Book'], meta: { name: 'Book' } }
    /**
     * Find zero or one Book that matches the filter.
     * @param {BookFindUniqueArgs} args - Arguments to find a Book
     * @example
     * // Get one Book
     * const book = await prisma.book.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BookFindUniqueArgs>(args: SelectSubset<T, BookFindUniqueArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Book that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {BookFindUniqueOrThrowArgs} args - Arguments to find a Book
     * @example
     * // Get one Book
     * const book = await prisma.book.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BookFindUniqueOrThrowArgs>(args: SelectSubset<T, BookFindUniqueOrThrowArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Book that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BookFindFirstArgs} args - Arguments to find a Book
     * @example
     * // Get one Book
     * const book = await prisma.book.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BookFindFirstArgs>(args?: SelectSubset<T, BookFindFirstArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Book that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BookFindFirstOrThrowArgs} args - Arguments to find a Book
     * @example
     * // Get one Book
     * const book = await prisma.book.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BookFindFirstOrThrowArgs>(args?: SelectSubset<T, BookFindFirstOrThrowArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Books that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BookFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Books
     * const books = await prisma.book.findMany()
     * 
     * // Get first 10 Books
     * const books = await prisma.book.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const bookWithIdOnly = await prisma.book.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends BookFindManyArgs>(args?: SelectSubset<T, BookFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Book.
     * @param {BookCreateArgs} args - Arguments to create a Book.
     * @example
     * // Create one Book
     * const Book = await prisma.book.create({
     *   data: {
     *     // ... data to create a Book
     *   }
     * })
     * 
     */
    create<T extends BookCreateArgs>(args: SelectSubset<T, BookCreateArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Books.
     * @param {BookCreateManyArgs} args - Arguments to create many Books.
     * @example
     * // Create many Books
     * const book = await prisma.book.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends BookCreateManyArgs>(args?: SelectSubset<T, BookCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Books and returns the data saved in the database.
     * @param {BookCreateManyAndReturnArgs} args - Arguments to create many Books.
     * @example
     * // Create many Books
     * const book = await prisma.book.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Books and only return the `id`
     * const bookWithIdOnly = await prisma.book.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends BookCreateManyAndReturnArgs>(args?: SelectSubset<T, BookCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Book.
     * @param {BookDeleteArgs} args - Arguments to delete one Book.
     * @example
     * // Delete one Book
     * const Book = await prisma.book.delete({
     *   where: {
     *     // ... filter to delete one Book
     *   }
     * })
     * 
     */
    delete<T extends BookDeleteArgs>(args: SelectSubset<T, BookDeleteArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Book.
     * @param {BookUpdateArgs} args - Arguments to update one Book.
     * @example
     * // Update one Book
     * const book = await prisma.book.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends BookUpdateArgs>(args: SelectSubset<T, BookUpdateArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Books.
     * @param {BookDeleteManyArgs} args - Arguments to filter Books to delete.
     * @example
     * // Delete a few Books
     * const { count } = await prisma.book.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends BookDeleteManyArgs>(args?: SelectSubset<T, BookDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Books.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BookUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Books
     * const book = await prisma.book.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends BookUpdateManyArgs>(args: SelectSubset<T, BookUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Books and returns the data updated in the database.
     * @param {BookUpdateManyAndReturnArgs} args - Arguments to update many Books.
     * @example
     * // Update many Books
     * const book = await prisma.book.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Books and only return the `id`
     * const bookWithIdOnly = await prisma.book.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends BookUpdateManyAndReturnArgs>(args: SelectSubset<T, BookUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Book.
     * @param {BookUpsertArgs} args - Arguments to update or create a Book.
     * @example
     * // Update or create a Book
     * const book = await prisma.book.upsert({
     *   create: {
     *     // ... data to create a Book
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Book we want to update
     *   }
     * })
     */
    upsert<T extends BookUpsertArgs>(args: SelectSubset<T, BookUpsertArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Books.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BookCountArgs} args - Arguments to filter Books to count.
     * @example
     * // Count the number of Books
     * const count = await prisma.book.count({
     *   where: {
     *     // ... the filter for the Books we want to count
     *   }
     * })
    **/
    count<T extends BookCountArgs>(
      args?: Subset<T, BookCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], BookCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Book.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BookAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends BookAggregateArgs>(args: Subset<T, BookAggregateArgs>): Prisma.PrismaPromise<GetBookAggregateType<T>>

    /**
     * Group by Book.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BookGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends BookGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BookGroupByArgs['orderBy'] }
        : { orderBy?: BookGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, BookGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBookGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Book model
   */
  readonly fields: BookFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Book.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BookClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    audioFiles<T extends Book$audioFilesArgs<ExtArgs> = {}>(args?: Subset<T, Book$audioFilesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    mergeAudits<T extends Book$mergeAuditsArgs<ExtArgs> = {}>(args?: Subset<T, Book$mergeAuditsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    characterProfiles<T extends Book$characterProfilesArgs<ExtArgs> = {}>(args?: Subset<T, Book$characterProfilesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    processingTasks<T extends Book$processingTasksArgs<ExtArgs> = {}>(args?: Subset<T, Book$processingTasksArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    scriptSentences<T extends Book$scriptSentencesArgs<ExtArgs> = {}>(args?: Subset<T, Book$scriptSentencesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    textSegments<T extends Book$textSegmentsArgs<ExtArgs> = {}>(args?: Subset<T, Book$textSegmentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Book model
   */
  interface BookFieldRefs {
    readonly id: FieldRef<"Book", 'String'>
    readonly title: FieldRef<"Book", 'String'>
    readonly author: FieldRef<"Book", 'String'>
    readonly originalFilename: FieldRef<"Book", 'String'>
    readonly uploadedFilePath: FieldRef<"Book", 'String'>
    readonly fileSize: FieldRef<"Book", 'BigInt'>
    readonly totalWords: FieldRef<"Book", 'Int'>
    readonly totalCharacters: FieldRef<"Book", 'Int'>
    readonly totalSegments: FieldRef<"Book", 'Int'>
    readonly encoding: FieldRef<"Book", 'String'>
    readonly fileFormat: FieldRef<"Book", 'String'>
    readonly status: FieldRef<"Book", 'String'>
    readonly metadata: FieldRef<"Book", 'Json'>
    readonly createdAt: FieldRef<"Book", 'DateTime'>
    readonly updatedAt: FieldRef<"Book", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Book findUnique
   */
  export type BookFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * Filter, which Book to fetch.
     */
    where: BookWhereUniqueInput
  }

  /**
   * Book findUniqueOrThrow
   */
  export type BookFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * Filter, which Book to fetch.
     */
    where: BookWhereUniqueInput
  }

  /**
   * Book findFirst
   */
  export type BookFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * Filter, which Book to fetch.
     */
    where?: BookWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Books to fetch.
     */
    orderBy?: BookOrderByWithRelationInput | BookOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Books.
     */
    cursor?: BookWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Books from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Books.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Books.
     */
    distinct?: BookScalarFieldEnum | BookScalarFieldEnum[]
  }

  /**
   * Book findFirstOrThrow
   */
  export type BookFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * Filter, which Book to fetch.
     */
    where?: BookWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Books to fetch.
     */
    orderBy?: BookOrderByWithRelationInput | BookOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Books.
     */
    cursor?: BookWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Books from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Books.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Books.
     */
    distinct?: BookScalarFieldEnum | BookScalarFieldEnum[]
  }

  /**
   * Book findMany
   */
  export type BookFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * Filter, which Books to fetch.
     */
    where?: BookWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Books to fetch.
     */
    orderBy?: BookOrderByWithRelationInput | BookOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Books.
     */
    cursor?: BookWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Books from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Books.
     */
    skip?: number
    distinct?: BookScalarFieldEnum | BookScalarFieldEnum[]
  }

  /**
   * Book create
   */
  export type BookCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * The data needed to create a Book.
     */
    data: XOR<BookCreateInput, BookUncheckedCreateInput>
  }

  /**
   * Book createMany
   */
  export type BookCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Books.
     */
    data: BookCreateManyInput | BookCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Book createManyAndReturn
   */
  export type BookCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * The data used to create many Books.
     */
    data: BookCreateManyInput | BookCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Book update
   */
  export type BookUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * The data needed to update a Book.
     */
    data: XOR<BookUpdateInput, BookUncheckedUpdateInput>
    /**
     * Choose, which Book to update.
     */
    where: BookWhereUniqueInput
  }

  /**
   * Book updateMany
   */
  export type BookUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Books.
     */
    data: XOR<BookUpdateManyMutationInput, BookUncheckedUpdateManyInput>
    /**
     * Filter which Books to update
     */
    where?: BookWhereInput
    /**
     * Limit how many Books to update.
     */
    limit?: number
  }

  /**
   * Book updateManyAndReturn
   */
  export type BookUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * The data used to update Books.
     */
    data: XOR<BookUpdateManyMutationInput, BookUncheckedUpdateManyInput>
    /**
     * Filter which Books to update
     */
    where?: BookWhereInput
    /**
     * Limit how many Books to update.
     */
    limit?: number
  }

  /**
   * Book upsert
   */
  export type BookUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * The filter to search for the Book to update in case it exists.
     */
    where: BookWhereUniqueInput
    /**
     * In case the Book found by the `where` argument doesn't exist, create a new Book with this data.
     */
    create: XOR<BookCreateInput, BookUncheckedCreateInput>
    /**
     * In case the Book was found with the provided `where` argument, update it with this data.
     */
    update: XOR<BookUpdateInput, BookUncheckedUpdateInput>
  }

  /**
   * Book delete
   */
  export type BookDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
    /**
     * Filter which Book to delete.
     */
    where: BookWhereUniqueInput
  }

  /**
   * Book deleteMany
   */
  export type BookDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Books to delete
     */
    where?: BookWhereInput
    /**
     * Limit how many Books to delete.
     */
    limit?: number
  }

  /**
   * Book.audioFiles
   */
  export type Book$audioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    where?: AudioFileWhereInput
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    cursor?: AudioFileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AudioFileScalarFieldEnum | AudioFileScalarFieldEnum[]
  }

  /**
   * Book.mergeAudits
   */
  export type Book$mergeAuditsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    where?: CharacterMergeAuditWhereInput
    orderBy?: CharacterMergeAuditOrderByWithRelationInput | CharacterMergeAuditOrderByWithRelationInput[]
    cursor?: CharacterMergeAuditWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CharacterMergeAuditScalarFieldEnum | CharacterMergeAuditScalarFieldEnum[]
  }

  /**
   * Book.characterProfiles
   */
  export type Book$characterProfilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    where?: CharacterProfileWhereInput
    orderBy?: CharacterProfileOrderByWithRelationInput | CharacterProfileOrderByWithRelationInput[]
    cursor?: CharacterProfileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CharacterProfileScalarFieldEnum | CharacterProfileScalarFieldEnum[]
  }

  /**
   * Book.processingTasks
   */
  export type Book$processingTasksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    where?: ProcessingTaskWhereInput
    orderBy?: ProcessingTaskOrderByWithRelationInput | ProcessingTaskOrderByWithRelationInput[]
    cursor?: ProcessingTaskWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ProcessingTaskScalarFieldEnum | ProcessingTaskScalarFieldEnum[]
  }

  /**
   * Book.scriptSentences
   */
  export type Book$scriptSentencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    where?: ScriptSentenceWhereInput
    orderBy?: ScriptSentenceOrderByWithRelationInput | ScriptSentenceOrderByWithRelationInput[]
    cursor?: ScriptSentenceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ScriptSentenceScalarFieldEnum | ScriptSentenceScalarFieldEnum[]
  }

  /**
   * Book.textSegments
   */
  export type Book$textSegmentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    where?: TextSegmentWhereInput
    orderBy?: TextSegmentOrderByWithRelationInput | TextSegmentOrderByWithRelationInput[]
    cursor?: TextSegmentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TextSegmentScalarFieldEnum | TextSegmentScalarFieldEnum[]
  }

  /**
   * Book without action
   */
  export type BookDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Book
     */
    select?: BookSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Book
     */
    omit?: BookOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BookInclude<ExtArgs> | null
  }


  /**
   * Model CharacterProfile
   */

  export type AggregateCharacterProfile = {
    _count: CharacterProfileCountAggregateOutputType | null
    _avg: CharacterProfileAvgAggregateOutputType | null
    _sum: CharacterProfileSumAggregateOutputType | null
    _min: CharacterProfileMinAggregateOutputType | null
    _max: CharacterProfileMaxAggregateOutputType | null
  }

  export type CharacterProfileAvgAggregateOutputType = {
    ageHint: number | null
    mentions: number | null
    quotes: number | null
  }

  export type CharacterProfileSumAggregateOutputType = {
    ageHint: number | null
    mentions: number | null
    quotes: number | null
  }

  export type CharacterProfileMinAggregateOutputType = {
    id: string | null
    bookId: string | null
    canonicalName: string | null
    genderHint: string | null
    ageHint: number | null
    emotionBaseline: string | null
    isActive: boolean | null
    mentions: number | null
    quotes: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CharacterProfileMaxAggregateOutputType = {
    id: string | null
    bookId: string | null
    canonicalName: string | null
    genderHint: string | null
    ageHint: number | null
    emotionBaseline: string | null
    isActive: boolean | null
    mentions: number | null
    quotes: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CharacterProfileCountAggregateOutputType = {
    id: number
    bookId: number
    canonicalName: number
    characteristics: number
    voicePreferences: number
    emotionProfile: number
    genderHint: number
    ageHint: number
    emotionBaseline: number
    isActive: number
    mentions: number
    quotes: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CharacterProfileAvgAggregateInputType = {
    ageHint?: true
    mentions?: true
    quotes?: true
  }

  export type CharacterProfileSumAggregateInputType = {
    ageHint?: true
    mentions?: true
    quotes?: true
  }

  export type CharacterProfileMinAggregateInputType = {
    id?: true
    bookId?: true
    canonicalName?: true
    genderHint?: true
    ageHint?: true
    emotionBaseline?: true
    isActive?: true
    mentions?: true
    quotes?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CharacterProfileMaxAggregateInputType = {
    id?: true
    bookId?: true
    canonicalName?: true
    genderHint?: true
    ageHint?: true
    emotionBaseline?: true
    isActive?: true
    mentions?: true
    quotes?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CharacterProfileCountAggregateInputType = {
    id?: true
    bookId?: true
    canonicalName?: true
    characteristics?: true
    voicePreferences?: true
    emotionProfile?: true
    genderHint?: true
    ageHint?: true
    emotionBaseline?: true
    isActive?: true
    mentions?: true
    quotes?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CharacterProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterProfile to aggregate.
     */
    where?: CharacterProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterProfiles to fetch.
     */
    orderBy?: CharacterProfileOrderByWithRelationInput | CharacterProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CharacterProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CharacterProfiles
    **/
    _count?: true | CharacterProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CharacterProfileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CharacterProfileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CharacterProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CharacterProfileMaxAggregateInputType
  }

  export type GetCharacterProfileAggregateType<T extends CharacterProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateCharacterProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCharacterProfile[P]>
      : GetScalarType<T[P], AggregateCharacterProfile[P]>
  }




  export type CharacterProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterProfileWhereInput
    orderBy?: CharacterProfileOrderByWithAggregationInput | CharacterProfileOrderByWithAggregationInput[]
    by: CharacterProfileScalarFieldEnum[] | CharacterProfileScalarFieldEnum
    having?: CharacterProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CharacterProfileCountAggregateInputType | true
    _avg?: CharacterProfileAvgAggregateInputType
    _sum?: CharacterProfileSumAggregateInputType
    _min?: CharacterProfileMinAggregateInputType
    _max?: CharacterProfileMaxAggregateInputType
  }

  export type CharacterProfileGroupByOutputType = {
    id: string
    bookId: string
    canonicalName: string
    characteristics: JsonValue
    voicePreferences: JsonValue
    emotionProfile: JsonValue
    genderHint: string
    ageHint: number | null
    emotionBaseline: string
    isActive: boolean
    mentions: number | null
    quotes: number | null
    createdAt: Date
    updatedAt: Date
    _count: CharacterProfileCountAggregateOutputType | null
    _avg: CharacterProfileAvgAggregateOutputType | null
    _sum: CharacterProfileSumAggregateOutputType | null
    _min: CharacterProfileMinAggregateOutputType | null
    _max: CharacterProfileMaxAggregateOutputType | null
  }

  type GetCharacterProfileGroupByPayload<T extends CharacterProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CharacterProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CharacterProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CharacterProfileGroupByOutputType[P]>
            : GetScalarType<T[P], CharacterProfileGroupByOutputType[P]>
        }
      >
    >


  export type CharacterProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    canonicalName?: boolean
    characteristics?: boolean
    voicePreferences?: boolean
    emotionProfile?: boolean
    genderHint?: boolean
    ageHint?: boolean
    emotionBaseline?: boolean
    isActive?: boolean
    mentions?: boolean
    quotes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    aliases?: boolean | CharacterProfile$aliasesArgs<ExtArgs>
    mergeAuditsSource?: boolean | CharacterProfile$mergeAuditsSourceArgs<ExtArgs>
    mergeAuditsTarget?: boolean | CharacterProfile$mergeAuditsTargetArgs<ExtArgs>
    book?: boolean | BookDefaultArgs<ExtArgs>
    voiceBindings?: boolean | CharacterProfile$voiceBindingsArgs<ExtArgs>
    scriptSentences?: boolean | CharacterProfile$scriptSentencesArgs<ExtArgs>
    _count?: boolean | CharacterProfileCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterProfile"]>

  export type CharacterProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    canonicalName?: boolean
    characteristics?: boolean
    voicePreferences?: boolean
    emotionProfile?: boolean
    genderHint?: boolean
    ageHint?: boolean
    emotionBaseline?: boolean
    isActive?: boolean
    mentions?: boolean
    quotes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterProfile"]>

  export type CharacterProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    canonicalName?: boolean
    characteristics?: boolean
    voicePreferences?: boolean
    emotionProfile?: boolean
    genderHint?: boolean
    ageHint?: boolean
    emotionBaseline?: boolean
    isActive?: boolean
    mentions?: boolean
    quotes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterProfile"]>

  export type CharacterProfileSelectScalar = {
    id?: boolean
    bookId?: boolean
    canonicalName?: boolean
    characteristics?: boolean
    voicePreferences?: boolean
    emotionProfile?: boolean
    genderHint?: boolean
    ageHint?: boolean
    emotionBaseline?: boolean
    isActive?: boolean
    mentions?: boolean
    quotes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CharacterProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bookId" | "canonicalName" | "characteristics" | "voicePreferences" | "emotionProfile" | "genderHint" | "ageHint" | "emotionBaseline" | "isActive" | "mentions" | "quotes" | "createdAt" | "updatedAt", ExtArgs["result"]["characterProfile"]>
  export type CharacterProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    aliases?: boolean | CharacterProfile$aliasesArgs<ExtArgs>
    mergeAuditsSource?: boolean | CharacterProfile$mergeAuditsSourceArgs<ExtArgs>
    mergeAuditsTarget?: boolean | CharacterProfile$mergeAuditsTargetArgs<ExtArgs>
    book?: boolean | BookDefaultArgs<ExtArgs>
    voiceBindings?: boolean | CharacterProfile$voiceBindingsArgs<ExtArgs>
    scriptSentences?: boolean | CharacterProfile$scriptSentencesArgs<ExtArgs>
    _count?: boolean | CharacterProfileCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CharacterProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
  }
  export type CharacterProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
  }

  export type $CharacterProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CharacterProfile"
    objects: {
      aliases: Prisma.$CharacterAliasPayload<ExtArgs>[]
      mergeAuditsSource: Prisma.$CharacterMergeAuditPayload<ExtArgs>[]
      mergeAuditsTarget: Prisma.$CharacterMergeAuditPayload<ExtArgs>[]
      book: Prisma.$BookPayload<ExtArgs>
      voiceBindings: Prisma.$CharacterVoiceBindingPayload<ExtArgs>[]
      scriptSentences: Prisma.$ScriptSentencePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bookId: string
      canonicalName: string
      characteristics: Prisma.JsonValue
      voicePreferences: Prisma.JsonValue
      emotionProfile: Prisma.JsonValue
      genderHint: string
      ageHint: number | null
      emotionBaseline: string
      isActive: boolean
      mentions: number | null
      quotes: number | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["characterProfile"]>
    composites: {}
  }

  type CharacterProfileGetPayload<S extends boolean | null | undefined | CharacterProfileDefaultArgs> = $Result.GetResult<Prisma.$CharacterProfilePayload, S>

  type CharacterProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CharacterProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CharacterProfileCountAggregateInputType | true
    }

  export interface CharacterProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CharacterProfile'], meta: { name: 'CharacterProfile' } }
    /**
     * Find zero or one CharacterProfile that matches the filter.
     * @param {CharacterProfileFindUniqueArgs} args - Arguments to find a CharacterProfile
     * @example
     * // Get one CharacterProfile
     * const characterProfile = await prisma.characterProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CharacterProfileFindUniqueArgs>(args: SelectSubset<T, CharacterProfileFindUniqueArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CharacterProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CharacterProfileFindUniqueOrThrowArgs} args - Arguments to find a CharacterProfile
     * @example
     * // Get one CharacterProfile
     * const characterProfile = await prisma.characterProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CharacterProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, CharacterProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterProfileFindFirstArgs} args - Arguments to find a CharacterProfile
     * @example
     * // Get one CharacterProfile
     * const characterProfile = await prisma.characterProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CharacterProfileFindFirstArgs>(args?: SelectSubset<T, CharacterProfileFindFirstArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterProfileFindFirstOrThrowArgs} args - Arguments to find a CharacterProfile
     * @example
     * // Get one CharacterProfile
     * const characterProfile = await prisma.characterProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CharacterProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, CharacterProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CharacterProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CharacterProfiles
     * const characterProfiles = await prisma.characterProfile.findMany()
     * 
     * // Get first 10 CharacterProfiles
     * const characterProfiles = await prisma.characterProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const characterProfileWithIdOnly = await prisma.characterProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CharacterProfileFindManyArgs>(args?: SelectSubset<T, CharacterProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CharacterProfile.
     * @param {CharacterProfileCreateArgs} args - Arguments to create a CharacterProfile.
     * @example
     * // Create one CharacterProfile
     * const CharacterProfile = await prisma.characterProfile.create({
     *   data: {
     *     // ... data to create a CharacterProfile
     *   }
     * })
     * 
     */
    create<T extends CharacterProfileCreateArgs>(args: SelectSubset<T, CharacterProfileCreateArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CharacterProfiles.
     * @param {CharacterProfileCreateManyArgs} args - Arguments to create many CharacterProfiles.
     * @example
     * // Create many CharacterProfiles
     * const characterProfile = await prisma.characterProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CharacterProfileCreateManyArgs>(args?: SelectSubset<T, CharacterProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CharacterProfiles and returns the data saved in the database.
     * @param {CharacterProfileCreateManyAndReturnArgs} args - Arguments to create many CharacterProfiles.
     * @example
     * // Create many CharacterProfiles
     * const characterProfile = await prisma.characterProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CharacterProfiles and only return the `id`
     * const characterProfileWithIdOnly = await prisma.characterProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CharacterProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, CharacterProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CharacterProfile.
     * @param {CharacterProfileDeleteArgs} args - Arguments to delete one CharacterProfile.
     * @example
     * // Delete one CharacterProfile
     * const CharacterProfile = await prisma.characterProfile.delete({
     *   where: {
     *     // ... filter to delete one CharacterProfile
     *   }
     * })
     * 
     */
    delete<T extends CharacterProfileDeleteArgs>(args: SelectSubset<T, CharacterProfileDeleteArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CharacterProfile.
     * @param {CharacterProfileUpdateArgs} args - Arguments to update one CharacterProfile.
     * @example
     * // Update one CharacterProfile
     * const characterProfile = await prisma.characterProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CharacterProfileUpdateArgs>(args: SelectSubset<T, CharacterProfileUpdateArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CharacterProfiles.
     * @param {CharacterProfileDeleteManyArgs} args - Arguments to filter CharacterProfiles to delete.
     * @example
     * // Delete a few CharacterProfiles
     * const { count } = await prisma.characterProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CharacterProfileDeleteManyArgs>(args?: SelectSubset<T, CharacterProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CharacterProfiles
     * const characterProfile = await prisma.characterProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CharacterProfileUpdateManyArgs>(args: SelectSubset<T, CharacterProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterProfiles and returns the data updated in the database.
     * @param {CharacterProfileUpdateManyAndReturnArgs} args - Arguments to update many CharacterProfiles.
     * @example
     * // Update many CharacterProfiles
     * const characterProfile = await prisma.characterProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CharacterProfiles and only return the `id`
     * const characterProfileWithIdOnly = await prisma.characterProfile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CharacterProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, CharacterProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CharacterProfile.
     * @param {CharacterProfileUpsertArgs} args - Arguments to update or create a CharacterProfile.
     * @example
     * // Update or create a CharacterProfile
     * const characterProfile = await prisma.characterProfile.upsert({
     *   create: {
     *     // ... data to create a CharacterProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CharacterProfile we want to update
     *   }
     * })
     */
    upsert<T extends CharacterProfileUpsertArgs>(args: SelectSubset<T, CharacterProfileUpsertArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CharacterProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterProfileCountArgs} args - Arguments to filter CharacterProfiles to count.
     * @example
     * // Count the number of CharacterProfiles
     * const count = await prisma.characterProfile.count({
     *   where: {
     *     // ... the filter for the CharacterProfiles we want to count
     *   }
     * })
    **/
    count<T extends CharacterProfileCountArgs>(
      args?: Subset<T, CharacterProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CharacterProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CharacterProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CharacterProfileAggregateArgs>(args: Subset<T, CharacterProfileAggregateArgs>): Prisma.PrismaPromise<GetCharacterProfileAggregateType<T>>

    /**
     * Group by CharacterProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CharacterProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CharacterProfileGroupByArgs['orderBy'] }
        : { orderBy?: CharacterProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CharacterProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCharacterProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CharacterProfile model
   */
  readonly fields: CharacterProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CharacterProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CharacterProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    aliases<T extends CharacterProfile$aliasesArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfile$aliasesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    mergeAuditsSource<T extends CharacterProfile$mergeAuditsSourceArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfile$mergeAuditsSourceArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    mergeAuditsTarget<T extends CharacterProfile$mergeAuditsTargetArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfile$mergeAuditsTargetArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    book<T extends BookDefaultArgs<ExtArgs> = {}>(args?: Subset<T, BookDefaultArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    voiceBindings<T extends CharacterProfile$voiceBindingsArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfile$voiceBindingsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    scriptSentences<T extends CharacterProfile$scriptSentencesArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfile$scriptSentencesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CharacterProfile model
   */
  interface CharacterProfileFieldRefs {
    readonly id: FieldRef<"CharacterProfile", 'String'>
    readonly bookId: FieldRef<"CharacterProfile", 'String'>
    readonly canonicalName: FieldRef<"CharacterProfile", 'String'>
    readonly characteristics: FieldRef<"CharacterProfile", 'Json'>
    readonly voicePreferences: FieldRef<"CharacterProfile", 'Json'>
    readonly emotionProfile: FieldRef<"CharacterProfile", 'Json'>
    readonly genderHint: FieldRef<"CharacterProfile", 'String'>
    readonly ageHint: FieldRef<"CharacterProfile", 'Int'>
    readonly emotionBaseline: FieldRef<"CharacterProfile", 'String'>
    readonly isActive: FieldRef<"CharacterProfile", 'Boolean'>
    readonly mentions: FieldRef<"CharacterProfile", 'Int'>
    readonly quotes: FieldRef<"CharacterProfile", 'Int'>
    readonly createdAt: FieldRef<"CharacterProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"CharacterProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CharacterProfile findUnique
   */
  export type CharacterProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * Filter, which CharacterProfile to fetch.
     */
    where: CharacterProfileWhereUniqueInput
  }

  /**
   * CharacterProfile findUniqueOrThrow
   */
  export type CharacterProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * Filter, which CharacterProfile to fetch.
     */
    where: CharacterProfileWhereUniqueInput
  }

  /**
   * CharacterProfile findFirst
   */
  export type CharacterProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * Filter, which CharacterProfile to fetch.
     */
    where?: CharacterProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterProfiles to fetch.
     */
    orderBy?: CharacterProfileOrderByWithRelationInput | CharacterProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterProfiles.
     */
    cursor?: CharacterProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterProfiles.
     */
    distinct?: CharacterProfileScalarFieldEnum | CharacterProfileScalarFieldEnum[]
  }

  /**
   * CharacterProfile findFirstOrThrow
   */
  export type CharacterProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * Filter, which CharacterProfile to fetch.
     */
    where?: CharacterProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterProfiles to fetch.
     */
    orderBy?: CharacterProfileOrderByWithRelationInput | CharacterProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterProfiles.
     */
    cursor?: CharacterProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterProfiles.
     */
    distinct?: CharacterProfileScalarFieldEnum | CharacterProfileScalarFieldEnum[]
  }

  /**
   * CharacterProfile findMany
   */
  export type CharacterProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * Filter, which CharacterProfiles to fetch.
     */
    where?: CharacterProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterProfiles to fetch.
     */
    orderBy?: CharacterProfileOrderByWithRelationInput | CharacterProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CharacterProfiles.
     */
    cursor?: CharacterProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterProfiles.
     */
    skip?: number
    distinct?: CharacterProfileScalarFieldEnum | CharacterProfileScalarFieldEnum[]
  }

  /**
   * CharacterProfile create
   */
  export type CharacterProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a CharacterProfile.
     */
    data: XOR<CharacterProfileCreateInput, CharacterProfileUncheckedCreateInput>
  }

  /**
   * CharacterProfile createMany
   */
  export type CharacterProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CharacterProfiles.
     */
    data: CharacterProfileCreateManyInput | CharacterProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CharacterProfile createManyAndReturn
   */
  export type CharacterProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * The data used to create many CharacterProfiles.
     */
    data: CharacterProfileCreateManyInput | CharacterProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterProfile update
   */
  export type CharacterProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a CharacterProfile.
     */
    data: XOR<CharacterProfileUpdateInput, CharacterProfileUncheckedUpdateInput>
    /**
     * Choose, which CharacterProfile to update.
     */
    where: CharacterProfileWhereUniqueInput
  }

  /**
   * CharacterProfile updateMany
   */
  export type CharacterProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CharacterProfiles.
     */
    data: XOR<CharacterProfileUpdateManyMutationInput, CharacterProfileUncheckedUpdateManyInput>
    /**
     * Filter which CharacterProfiles to update
     */
    where?: CharacterProfileWhereInput
    /**
     * Limit how many CharacterProfiles to update.
     */
    limit?: number
  }

  /**
   * CharacterProfile updateManyAndReturn
   */
  export type CharacterProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * The data used to update CharacterProfiles.
     */
    data: XOR<CharacterProfileUpdateManyMutationInput, CharacterProfileUncheckedUpdateManyInput>
    /**
     * Filter which CharacterProfiles to update
     */
    where?: CharacterProfileWhereInput
    /**
     * Limit how many CharacterProfiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterProfile upsert
   */
  export type CharacterProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the CharacterProfile to update in case it exists.
     */
    where: CharacterProfileWhereUniqueInput
    /**
     * In case the CharacterProfile found by the `where` argument doesn't exist, create a new CharacterProfile with this data.
     */
    create: XOR<CharacterProfileCreateInput, CharacterProfileUncheckedCreateInput>
    /**
     * In case the CharacterProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CharacterProfileUpdateInput, CharacterProfileUncheckedUpdateInput>
  }

  /**
   * CharacterProfile delete
   */
  export type CharacterProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    /**
     * Filter which CharacterProfile to delete.
     */
    where: CharacterProfileWhereUniqueInput
  }

  /**
   * CharacterProfile deleteMany
   */
  export type CharacterProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterProfiles to delete
     */
    where?: CharacterProfileWhereInput
    /**
     * Limit how many CharacterProfiles to delete.
     */
    limit?: number
  }

  /**
   * CharacterProfile.aliases
   */
  export type CharacterProfile$aliasesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    where?: CharacterAliasWhereInput
    orderBy?: CharacterAliasOrderByWithRelationInput | CharacterAliasOrderByWithRelationInput[]
    cursor?: CharacterAliasWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CharacterAliasScalarFieldEnum | CharacterAliasScalarFieldEnum[]
  }

  /**
   * CharacterProfile.mergeAuditsSource
   */
  export type CharacterProfile$mergeAuditsSourceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    where?: CharacterMergeAuditWhereInput
    orderBy?: CharacterMergeAuditOrderByWithRelationInput | CharacterMergeAuditOrderByWithRelationInput[]
    cursor?: CharacterMergeAuditWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CharacterMergeAuditScalarFieldEnum | CharacterMergeAuditScalarFieldEnum[]
  }

  /**
   * CharacterProfile.mergeAuditsTarget
   */
  export type CharacterProfile$mergeAuditsTargetArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    where?: CharacterMergeAuditWhereInput
    orderBy?: CharacterMergeAuditOrderByWithRelationInput | CharacterMergeAuditOrderByWithRelationInput[]
    cursor?: CharacterMergeAuditWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CharacterMergeAuditScalarFieldEnum | CharacterMergeAuditScalarFieldEnum[]
  }

  /**
   * CharacterProfile.voiceBindings
   */
  export type CharacterProfile$voiceBindingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    where?: CharacterVoiceBindingWhereInput
    orderBy?: CharacterVoiceBindingOrderByWithRelationInput | CharacterVoiceBindingOrderByWithRelationInput[]
    cursor?: CharacterVoiceBindingWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CharacterVoiceBindingScalarFieldEnum | CharacterVoiceBindingScalarFieldEnum[]
  }

  /**
   * CharacterProfile.scriptSentences
   */
  export type CharacterProfile$scriptSentencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    where?: ScriptSentenceWhereInput
    orderBy?: ScriptSentenceOrderByWithRelationInput | ScriptSentenceOrderByWithRelationInput[]
    cursor?: ScriptSentenceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ScriptSentenceScalarFieldEnum | ScriptSentenceScalarFieldEnum[]
  }

  /**
   * CharacterProfile without action
   */
  export type CharacterProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
  }


  /**
   * Model CharacterAlias
   */

  export type AggregateCharacterAlias = {
    _count: CharacterAliasCountAggregateOutputType | null
    _avg: CharacterAliasAvgAggregateOutputType | null
    _sum: CharacterAliasSumAggregateOutputType | null
    _min: CharacterAliasMinAggregateOutputType | null
    _max: CharacterAliasMaxAggregateOutputType | null
  }

  export type CharacterAliasAvgAggregateOutputType = {
    confidence: Decimal | null
  }

  export type CharacterAliasSumAggregateOutputType = {
    confidence: Decimal | null
  }

  export type CharacterAliasMinAggregateOutputType = {
    id: string | null
    characterId: string | null
    alias: string | null
    confidence: Decimal | null
    sourceSentence: string | null
    createdAt: Date | null
  }

  export type CharacterAliasMaxAggregateOutputType = {
    id: string | null
    characterId: string | null
    alias: string | null
    confidence: Decimal | null
    sourceSentence: string | null
    createdAt: Date | null
  }

  export type CharacterAliasCountAggregateOutputType = {
    id: number
    characterId: number
    alias: number
    confidence: number
    sourceSentence: number
    createdAt: number
    _all: number
  }


  export type CharacterAliasAvgAggregateInputType = {
    confidence?: true
  }

  export type CharacterAliasSumAggregateInputType = {
    confidence?: true
  }

  export type CharacterAliasMinAggregateInputType = {
    id?: true
    characterId?: true
    alias?: true
    confidence?: true
    sourceSentence?: true
    createdAt?: true
  }

  export type CharacterAliasMaxAggregateInputType = {
    id?: true
    characterId?: true
    alias?: true
    confidence?: true
    sourceSentence?: true
    createdAt?: true
  }

  export type CharacterAliasCountAggregateInputType = {
    id?: true
    characterId?: true
    alias?: true
    confidence?: true
    sourceSentence?: true
    createdAt?: true
    _all?: true
  }

  export type CharacterAliasAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterAlias to aggregate.
     */
    where?: CharacterAliasWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterAliases to fetch.
     */
    orderBy?: CharacterAliasOrderByWithRelationInput | CharacterAliasOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CharacterAliasWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterAliases from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterAliases.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CharacterAliases
    **/
    _count?: true | CharacterAliasCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CharacterAliasAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CharacterAliasSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CharacterAliasMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CharacterAliasMaxAggregateInputType
  }

  export type GetCharacterAliasAggregateType<T extends CharacterAliasAggregateArgs> = {
        [P in keyof T & keyof AggregateCharacterAlias]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCharacterAlias[P]>
      : GetScalarType<T[P], AggregateCharacterAlias[P]>
  }




  export type CharacterAliasGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterAliasWhereInput
    orderBy?: CharacterAliasOrderByWithAggregationInput | CharacterAliasOrderByWithAggregationInput[]
    by: CharacterAliasScalarFieldEnum[] | CharacterAliasScalarFieldEnum
    having?: CharacterAliasScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CharacterAliasCountAggregateInputType | true
    _avg?: CharacterAliasAvgAggregateInputType
    _sum?: CharacterAliasSumAggregateInputType
    _min?: CharacterAliasMinAggregateInputType
    _max?: CharacterAliasMaxAggregateInputType
  }

  export type CharacterAliasGroupByOutputType = {
    id: string
    characterId: string
    alias: string
    confidence: Decimal
    sourceSentence: string | null
    createdAt: Date
    _count: CharacterAliasCountAggregateOutputType | null
    _avg: CharacterAliasAvgAggregateOutputType | null
    _sum: CharacterAliasSumAggregateOutputType | null
    _min: CharacterAliasMinAggregateOutputType | null
    _max: CharacterAliasMaxAggregateOutputType | null
  }

  type GetCharacterAliasGroupByPayload<T extends CharacterAliasGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CharacterAliasGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CharacterAliasGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CharacterAliasGroupByOutputType[P]>
            : GetScalarType<T[P], CharacterAliasGroupByOutputType[P]>
        }
      >
    >


  export type CharacterAliasSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    characterId?: boolean
    alias?: boolean
    confidence?: boolean
    sourceSentence?: boolean
    createdAt?: boolean
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterAlias"]>

  export type CharacterAliasSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    characterId?: boolean
    alias?: boolean
    confidence?: boolean
    sourceSentence?: boolean
    createdAt?: boolean
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterAlias"]>

  export type CharacterAliasSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    characterId?: boolean
    alias?: boolean
    confidence?: boolean
    sourceSentence?: boolean
    createdAt?: boolean
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterAlias"]>

  export type CharacterAliasSelectScalar = {
    id?: boolean
    characterId?: boolean
    alias?: boolean
    confidence?: boolean
    sourceSentence?: boolean
    createdAt?: boolean
  }

  export type CharacterAliasOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "characterId" | "alias" | "confidence" | "sourceSentence" | "createdAt", ExtArgs["result"]["characterAlias"]>
  export type CharacterAliasInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }
  export type CharacterAliasIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }
  export type CharacterAliasIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }

  export type $CharacterAliasPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CharacterAlias"
    objects: {
      character: Prisma.$CharacterProfilePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      characterId: string
      alias: string
      confidence: Prisma.Decimal
      sourceSentence: string | null
      createdAt: Date
    }, ExtArgs["result"]["characterAlias"]>
    composites: {}
  }

  type CharacterAliasGetPayload<S extends boolean | null | undefined | CharacterAliasDefaultArgs> = $Result.GetResult<Prisma.$CharacterAliasPayload, S>

  type CharacterAliasCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CharacterAliasFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CharacterAliasCountAggregateInputType | true
    }

  export interface CharacterAliasDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CharacterAlias'], meta: { name: 'CharacterAlias' } }
    /**
     * Find zero or one CharacterAlias that matches the filter.
     * @param {CharacterAliasFindUniqueArgs} args - Arguments to find a CharacterAlias
     * @example
     * // Get one CharacterAlias
     * const characterAlias = await prisma.characterAlias.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CharacterAliasFindUniqueArgs>(args: SelectSubset<T, CharacterAliasFindUniqueArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CharacterAlias that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CharacterAliasFindUniqueOrThrowArgs} args - Arguments to find a CharacterAlias
     * @example
     * // Get one CharacterAlias
     * const characterAlias = await prisma.characterAlias.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CharacterAliasFindUniqueOrThrowArgs>(args: SelectSubset<T, CharacterAliasFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterAlias that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterAliasFindFirstArgs} args - Arguments to find a CharacterAlias
     * @example
     * // Get one CharacterAlias
     * const characterAlias = await prisma.characterAlias.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CharacterAliasFindFirstArgs>(args?: SelectSubset<T, CharacterAliasFindFirstArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterAlias that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterAliasFindFirstOrThrowArgs} args - Arguments to find a CharacterAlias
     * @example
     * // Get one CharacterAlias
     * const characterAlias = await prisma.characterAlias.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CharacterAliasFindFirstOrThrowArgs>(args?: SelectSubset<T, CharacterAliasFindFirstOrThrowArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CharacterAliases that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterAliasFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CharacterAliases
     * const characterAliases = await prisma.characterAlias.findMany()
     * 
     * // Get first 10 CharacterAliases
     * const characterAliases = await prisma.characterAlias.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const characterAliasWithIdOnly = await prisma.characterAlias.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CharacterAliasFindManyArgs>(args?: SelectSubset<T, CharacterAliasFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CharacterAlias.
     * @param {CharacterAliasCreateArgs} args - Arguments to create a CharacterAlias.
     * @example
     * // Create one CharacterAlias
     * const CharacterAlias = await prisma.characterAlias.create({
     *   data: {
     *     // ... data to create a CharacterAlias
     *   }
     * })
     * 
     */
    create<T extends CharacterAliasCreateArgs>(args: SelectSubset<T, CharacterAliasCreateArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CharacterAliases.
     * @param {CharacterAliasCreateManyArgs} args - Arguments to create many CharacterAliases.
     * @example
     * // Create many CharacterAliases
     * const characterAlias = await prisma.characterAlias.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CharacterAliasCreateManyArgs>(args?: SelectSubset<T, CharacterAliasCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CharacterAliases and returns the data saved in the database.
     * @param {CharacterAliasCreateManyAndReturnArgs} args - Arguments to create many CharacterAliases.
     * @example
     * // Create many CharacterAliases
     * const characterAlias = await prisma.characterAlias.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CharacterAliases and only return the `id`
     * const characterAliasWithIdOnly = await prisma.characterAlias.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CharacterAliasCreateManyAndReturnArgs>(args?: SelectSubset<T, CharacterAliasCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CharacterAlias.
     * @param {CharacterAliasDeleteArgs} args - Arguments to delete one CharacterAlias.
     * @example
     * // Delete one CharacterAlias
     * const CharacterAlias = await prisma.characterAlias.delete({
     *   where: {
     *     // ... filter to delete one CharacterAlias
     *   }
     * })
     * 
     */
    delete<T extends CharacterAliasDeleteArgs>(args: SelectSubset<T, CharacterAliasDeleteArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CharacterAlias.
     * @param {CharacterAliasUpdateArgs} args - Arguments to update one CharacterAlias.
     * @example
     * // Update one CharacterAlias
     * const characterAlias = await prisma.characterAlias.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CharacterAliasUpdateArgs>(args: SelectSubset<T, CharacterAliasUpdateArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CharacterAliases.
     * @param {CharacterAliasDeleteManyArgs} args - Arguments to filter CharacterAliases to delete.
     * @example
     * // Delete a few CharacterAliases
     * const { count } = await prisma.characterAlias.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CharacterAliasDeleteManyArgs>(args?: SelectSubset<T, CharacterAliasDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterAliases.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterAliasUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CharacterAliases
     * const characterAlias = await prisma.characterAlias.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CharacterAliasUpdateManyArgs>(args: SelectSubset<T, CharacterAliasUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterAliases and returns the data updated in the database.
     * @param {CharacterAliasUpdateManyAndReturnArgs} args - Arguments to update many CharacterAliases.
     * @example
     * // Update many CharacterAliases
     * const characterAlias = await prisma.characterAlias.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CharacterAliases and only return the `id`
     * const characterAliasWithIdOnly = await prisma.characterAlias.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CharacterAliasUpdateManyAndReturnArgs>(args: SelectSubset<T, CharacterAliasUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CharacterAlias.
     * @param {CharacterAliasUpsertArgs} args - Arguments to update or create a CharacterAlias.
     * @example
     * // Update or create a CharacterAlias
     * const characterAlias = await prisma.characterAlias.upsert({
     *   create: {
     *     // ... data to create a CharacterAlias
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CharacterAlias we want to update
     *   }
     * })
     */
    upsert<T extends CharacterAliasUpsertArgs>(args: SelectSubset<T, CharacterAliasUpsertArgs<ExtArgs>>): Prisma__CharacterAliasClient<$Result.GetResult<Prisma.$CharacterAliasPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CharacterAliases.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterAliasCountArgs} args - Arguments to filter CharacterAliases to count.
     * @example
     * // Count the number of CharacterAliases
     * const count = await prisma.characterAlias.count({
     *   where: {
     *     // ... the filter for the CharacterAliases we want to count
     *   }
     * })
    **/
    count<T extends CharacterAliasCountArgs>(
      args?: Subset<T, CharacterAliasCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CharacterAliasCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CharacterAlias.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterAliasAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CharacterAliasAggregateArgs>(args: Subset<T, CharacterAliasAggregateArgs>): Prisma.PrismaPromise<GetCharacterAliasAggregateType<T>>

    /**
     * Group by CharacterAlias.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterAliasGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CharacterAliasGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CharacterAliasGroupByArgs['orderBy'] }
        : { orderBy?: CharacterAliasGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CharacterAliasGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCharacterAliasGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CharacterAlias model
   */
  readonly fields: CharacterAliasFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CharacterAlias.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CharacterAliasClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    character<T extends CharacterProfileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfileDefaultArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CharacterAlias model
   */
  interface CharacterAliasFieldRefs {
    readonly id: FieldRef<"CharacterAlias", 'String'>
    readonly characterId: FieldRef<"CharacterAlias", 'String'>
    readonly alias: FieldRef<"CharacterAlias", 'String'>
    readonly confidence: FieldRef<"CharacterAlias", 'Decimal'>
    readonly sourceSentence: FieldRef<"CharacterAlias", 'String'>
    readonly createdAt: FieldRef<"CharacterAlias", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CharacterAlias findUnique
   */
  export type CharacterAliasFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * Filter, which CharacterAlias to fetch.
     */
    where: CharacterAliasWhereUniqueInput
  }

  /**
   * CharacterAlias findUniqueOrThrow
   */
  export type CharacterAliasFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * Filter, which CharacterAlias to fetch.
     */
    where: CharacterAliasWhereUniqueInput
  }

  /**
   * CharacterAlias findFirst
   */
  export type CharacterAliasFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * Filter, which CharacterAlias to fetch.
     */
    where?: CharacterAliasWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterAliases to fetch.
     */
    orderBy?: CharacterAliasOrderByWithRelationInput | CharacterAliasOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterAliases.
     */
    cursor?: CharacterAliasWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterAliases from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterAliases.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterAliases.
     */
    distinct?: CharacterAliasScalarFieldEnum | CharacterAliasScalarFieldEnum[]
  }

  /**
   * CharacterAlias findFirstOrThrow
   */
  export type CharacterAliasFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * Filter, which CharacterAlias to fetch.
     */
    where?: CharacterAliasWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterAliases to fetch.
     */
    orderBy?: CharacterAliasOrderByWithRelationInput | CharacterAliasOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterAliases.
     */
    cursor?: CharacterAliasWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterAliases from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterAliases.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterAliases.
     */
    distinct?: CharacterAliasScalarFieldEnum | CharacterAliasScalarFieldEnum[]
  }

  /**
   * CharacterAlias findMany
   */
  export type CharacterAliasFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * Filter, which CharacterAliases to fetch.
     */
    where?: CharacterAliasWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterAliases to fetch.
     */
    orderBy?: CharacterAliasOrderByWithRelationInput | CharacterAliasOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CharacterAliases.
     */
    cursor?: CharacterAliasWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterAliases from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterAliases.
     */
    skip?: number
    distinct?: CharacterAliasScalarFieldEnum | CharacterAliasScalarFieldEnum[]
  }

  /**
   * CharacterAlias create
   */
  export type CharacterAliasCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * The data needed to create a CharacterAlias.
     */
    data: XOR<CharacterAliasCreateInput, CharacterAliasUncheckedCreateInput>
  }

  /**
   * CharacterAlias createMany
   */
  export type CharacterAliasCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CharacterAliases.
     */
    data: CharacterAliasCreateManyInput | CharacterAliasCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CharacterAlias createManyAndReturn
   */
  export type CharacterAliasCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * The data used to create many CharacterAliases.
     */
    data: CharacterAliasCreateManyInput | CharacterAliasCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterAlias update
   */
  export type CharacterAliasUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * The data needed to update a CharacterAlias.
     */
    data: XOR<CharacterAliasUpdateInput, CharacterAliasUncheckedUpdateInput>
    /**
     * Choose, which CharacterAlias to update.
     */
    where: CharacterAliasWhereUniqueInput
  }

  /**
   * CharacterAlias updateMany
   */
  export type CharacterAliasUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CharacterAliases.
     */
    data: XOR<CharacterAliasUpdateManyMutationInput, CharacterAliasUncheckedUpdateManyInput>
    /**
     * Filter which CharacterAliases to update
     */
    where?: CharacterAliasWhereInput
    /**
     * Limit how many CharacterAliases to update.
     */
    limit?: number
  }

  /**
   * CharacterAlias updateManyAndReturn
   */
  export type CharacterAliasUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * The data used to update CharacterAliases.
     */
    data: XOR<CharacterAliasUpdateManyMutationInput, CharacterAliasUncheckedUpdateManyInput>
    /**
     * Filter which CharacterAliases to update
     */
    where?: CharacterAliasWhereInput
    /**
     * Limit how many CharacterAliases to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterAlias upsert
   */
  export type CharacterAliasUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * The filter to search for the CharacterAlias to update in case it exists.
     */
    where: CharacterAliasWhereUniqueInput
    /**
     * In case the CharacterAlias found by the `where` argument doesn't exist, create a new CharacterAlias with this data.
     */
    create: XOR<CharacterAliasCreateInput, CharacterAliasUncheckedCreateInput>
    /**
     * In case the CharacterAlias was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CharacterAliasUpdateInput, CharacterAliasUncheckedUpdateInput>
  }

  /**
   * CharacterAlias delete
   */
  export type CharacterAliasDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
    /**
     * Filter which CharacterAlias to delete.
     */
    where: CharacterAliasWhereUniqueInput
  }

  /**
   * CharacterAlias deleteMany
   */
  export type CharacterAliasDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterAliases to delete
     */
    where?: CharacterAliasWhereInput
    /**
     * Limit how many CharacterAliases to delete.
     */
    limit?: number
  }

  /**
   * CharacterAlias without action
   */
  export type CharacterAliasDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterAlias
     */
    select?: CharacterAliasSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterAlias
     */
    omit?: CharacterAliasOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterAliasInclude<ExtArgs> | null
  }


  /**
   * Model TTSVoiceProfile
   */

  export type AggregateTTSVoiceProfile = {
    _count: TTSVoiceProfileCountAggregateOutputType | null
    _avg: TTSVoiceProfileAvgAggregateOutputType | null
    _sum: TTSVoiceProfileSumAggregateOutputType | null
    _min: TTSVoiceProfileMinAggregateOutputType | null
    _max: TTSVoiceProfileMaxAggregateOutputType | null
  }

  export type TTSVoiceProfileAvgAggregateOutputType = {
    usageCount: number | null
    rating: Decimal | null
  }

  export type TTSVoiceProfileSumAggregateOutputType = {
    usageCount: number | null
    rating: Decimal | null
  }

  export type TTSVoiceProfileMinAggregateOutputType = {
    id: string | null
    provider: string | null
    voiceId: string | null
    voiceName: string | null
    displayName: string | null
    description: string | null
    usageCount: number | null
    rating: Decimal | null
    isAvailable: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TTSVoiceProfileMaxAggregateOutputType = {
    id: string | null
    provider: string | null
    voiceId: string | null
    voiceName: string | null
    displayName: string | null
    description: string | null
    usageCount: number | null
    rating: Decimal | null
    isAvailable: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TTSVoiceProfileCountAggregateOutputType = {
    id: number
    provider: number
    voiceId: number
    voiceName: number
    displayName: number
    description: number
    characteristics: number
    defaultParameters: number
    previewAudio: number
    usageCount: number
    rating: number
    isAvailable: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TTSVoiceProfileAvgAggregateInputType = {
    usageCount?: true
    rating?: true
  }

  export type TTSVoiceProfileSumAggregateInputType = {
    usageCount?: true
    rating?: true
  }

  export type TTSVoiceProfileMinAggregateInputType = {
    id?: true
    provider?: true
    voiceId?: true
    voiceName?: true
    displayName?: true
    description?: true
    usageCount?: true
    rating?: true
    isAvailable?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TTSVoiceProfileMaxAggregateInputType = {
    id?: true
    provider?: true
    voiceId?: true
    voiceName?: true
    displayName?: true
    description?: true
    usageCount?: true
    rating?: true
    isAvailable?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TTSVoiceProfileCountAggregateInputType = {
    id?: true
    provider?: true
    voiceId?: true
    voiceName?: true
    displayName?: true
    description?: true
    characteristics?: true
    defaultParameters?: true
    previewAudio?: true
    usageCount?: true
    rating?: true
    isAvailable?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TTSVoiceProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TTSVoiceProfile to aggregate.
     */
    where?: TTSVoiceProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TTSVoiceProfiles to fetch.
     */
    orderBy?: TTSVoiceProfileOrderByWithRelationInput | TTSVoiceProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TTSVoiceProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TTSVoiceProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TTSVoiceProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TTSVoiceProfiles
    **/
    _count?: true | TTSVoiceProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TTSVoiceProfileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TTSVoiceProfileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TTSVoiceProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TTSVoiceProfileMaxAggregateInputType
  }

  export type GetTTSVoiceProfileAggregateType<T extends TTSVoiceProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateTTSVoiceProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTTSVoiceProfile[P]>
      : GetScalarType<T[P], AggregateTTSVoiceProfile[P]>
  }




  export type TTSVoiceProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TTSVoiceProfileWhereInput
    orderBy?: TTSVoiceProfileOrderByWithAggregationInput | TTSVoiceProfileOrderByWithAggregationInput[]
    by: TTSVoiceProfileScalarFieldEnum[] | TTSVoiceProfileScalarFieldEnum
    having?: TTSVoiceProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TTSVoiceProfileCountAggregateInputType | true
    _avg?: TTSVoiceProfileAvgAggregateInputType
    _sum?: TTSVoiceProfileSumAggregateInputType
    _min?: TTSVoiceProfileMinAggregateInputType
    _max?: TTSVoiceProfileMaxAggregateInputType
  }

  export type TTSVoiceProfileGroupByOutputType = {
    id: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description: string | null
    characteristics: JsonValue
    defaultParameters: JsonValue
    previewAudio: JsonValue | null
    usageCount: number
    rating: Decimal
    isAvailable: boolean
    createdAt: Date
    updatedAt: Date
    _count: TTSVoiceProfileCountAggregateOutputType | null
    _avg: TTSVoiceProfileAvgAggregateOutputType | null
    _sum: TTSVoiceProfileSumAggregateOutputType | null
    _min: TTSVoiceProfileMinAggregateOutputType | null
    _max: TTSVoiceProfileMaxAggregateOutputType | null
  }

  type GetTTSVoiceProfileGroupByPayload<T extends TTSVoiceProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TTSVoiceProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TTSVoiceProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TTSVoiceProfileGroupByOutputType[P]>
            : GetScalarType<T[P], TTSVoiceProfileGroupByOutputType[P]>
        }
      >
    >


  export type TTSVoiceProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    voiceId?: boolean
    voiceName?: boolean
    displayName?: boolean
    description?: boolean
    characteristics?: boolean
    defaultParameters?: boolean
    previewAudio?: boolean
    usageCount?: boolean
    rating?: boolean
    isAvailable?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    audioFiles?: boolean | TTSVoiceProfile$audioFilesArgs<ExtArgs>
    voiceBindings?: boolean | TTSVoiceProfile$voiceBindingsArgs<ExtArgs>
    _count?: boolean | TTSVoiceProfileCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["tTSVoiceProfile"]>

  export type TTSVoiceProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    voiceId?: boolean
    voiceName?: boolean
    displayName?: boolean
    description?: boolean
    characteristics?: boolean
    defaultParameters?: boolean
    previewAudio?: boolean
    usageCount?: boolean
    rating?: boolean
    isAvailable?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tTSVoiceProfile"]>

  export type TTSVoiceProfileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    provider?: boolean
    voiceId?: boolean
    voiceName?: boolean
    displayName?: boolean
    description?: boolean
    characteristics?: boolean
    defaultParameters?: boolean
    previewAudio?: boolean
    usageCount?: boolean
    rating?: boolean
    isAvailable?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["tTSVoiceProfile"]>

  export type TTSVoiceProfileSelectScalar = {
    id?: boolean
    provider?: boolean
    voiceId?: boolean
    voiceName?: boolean
    displayName?: boolean
    description?: boolean
    characteristics?: boolean
    defaultParameters?: boolean
    previewAudio?: boolean
    usageCount?: boolean
    rating?: boolean
    isAvailable?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TTSVoiceProfileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "provider" | "voiceId" | "voiceName" | "displayName" | "description" | "characteristics" | "defaultParameters" | "previewAudio" | "usageCount" | "rating" | "isAvailable" | "createdAt" | "updatedAt", ExtArgs["result"]["tTSVoiceProfile"]>
  export type TTSVoiceProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | TTSVoiceProfile$audioFilesArgs<ExtArgs>
    voiceBindings?: boolean | TTSVoiceProfile$voiceBindingsArgs<ExtArgs>
    _count?: boolean | TTSVoiceProfileCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type TTSVoiceProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type TTSVoiceProfileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $TTSVoiceProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TTSVoiceProfile"
    objects: {
      audioFiles: Prisma.$AudioFilePayload<ExtArgs>[]
      voiceBindings: Prisma.$CharacterVoiceBindingPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      provider: string
      voiceId: string
      voiceName: string
      displayName: string
      description: string | null
      characteristics: Prisma.JsonValue
      defaultParameters: Prisma.JsonValue
      previewAudio: Prisma.JsonValue | null
      usageCount: number
      rating: Prisma.Decimal
      isAvailable: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["tTSVoiceProfile"]>
    composites: {}
  }

  type TTSVoiceProfileGetPayload<S extends boolean | null | undefined | TTSVoiceProfileDefaultArgs> = $Result.GetResult<Prisma.$TTSVoiceProfilePayload, S>

  type TTSVoiceProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TTSVoiceProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TTSVoiceProfileCountAggregateInputType | true
    }

  export interface TTSVoiceProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TTSVoiceProfile'], meta: { name: 'TTSVoiceProfile' } }
    /**
     * Find zero or one TTSVoiceProfile that matches the filter.
     * @param {TTSVoiceProfileFindUniqueArgs} args - Arguments to find a TTSVoiceProfile
     * @example
     * // Get one TTSVoiceProfile
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TTSVoiceProfileFindUniqueArgs>(args: SelectSubset<T, TTSVoiceProfileFindUniqueArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TTSVoiceProfile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TTSVoiceProfileFindUniqueOrThrowArgs} args - Arguments to find a TTSVoiceProfile
     * @example
     * // Get one TTSVoiceProfile
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TTSVoiceProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, TTSVoiceProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TTSVoiceProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TTSVoiceProfileFindFirstArgs} args - Arguments to find a TTSVoiceProfile
     * @example
     * // Get one TTSVoiceProfile
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TTSVoiceProfileFindFirstArgs>(args?: SelectSubset<T, TTSVoiceProfileFindFirstArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TTSVoiceProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TTSVoiceProfileFindFirstOrThrowArgs} args - Arguments to find a TTSVoiceProfile
     * @example
     * // Get one TTSVoiceProfile
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TTSVoiceProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, TTSVoiceProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TTSVoiceProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TTSVoiceProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TTSVoiceProfiles
     * const tTSVoiceProfiles = await prisma.tTSVoiceProfile.findMany()
     * 
     * // Get first 10 TTSVoiceProfiles
     * const tTSVoiceProfiles = await prisma.tTSVoiceProfile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tTSVoiceProfileWithIdOnly = await prisma.tTSVoiceProfile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TTSVoiceProfileFindManyArgs>(args?: SelectSubset<T, TTSVoiceProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TTSVoiceProfile.
     * @param {TTSVoiceProfileCreateArgs} args - Arguments to create a TTSVoiceProfile.
     * @example
     * // Create one TTSVoiceProfile
     * const TTSVoiceProfile = await prisma.tTSVoiceProfile.create({
     *   data: {
     *     // ... data to create a TTSVoiceProfile
     *   }
     * })
     * 
     */
    create<T extends TTSVoiceProfileCreateArgs>(args: SelectSubset<T, TTSVoiceProfileCreateArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TTSVoiceProfiles.
     * @param {TTSVoiceProfileCreateManyArgs} args - Arguments to create many TTSVoiceProfiles.
     * @example
     * // Create many TTSVoiceProfiles
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TTSVoiceProfileCreateManyArgs>(args?: SelectSubset<T, TTSVoiceProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TTSVoiceProfiles and returns the data saved in the database.
     * @param {TTSVoiceProfileCreateManyAndReturnArgs} args - Arguments to create many TTSVoiceProfiles.
     * @example
     * // Create many TTSVoiceProfiles
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TTSVoiceProfiles and only return the `id`
     * const tTSVoiceProfileWithIdOnly = await prisma.tTSVoiceProfile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TTSVoiceProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, TTSVoiceProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TTSVoiceProfile.
     * @param {TTSVoiceProfileDeleteArgs} args - Arguments to delete one TTSVoiceProfile.
     * @example
     * // Delete one TTSVoiceProfile
     * const TTSVoiceProfile = await prisma.tTSVoiceProfile.delete({
     *   where: {
     *     // ... filter to delete one TTSVoiceProfile
     *   }
     * })
     * 
     */
    delete<T extends TTSVoiceProfileDeleteArgs>(args: SelectSubset<T, TTSVoiceProfileDeleteArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TTSVoiceProfile.
     * @param {TTSVoiceProfileUpdateArgs} args - Arguments to update one TTSVoiceProfile.
     * @example
     * // Update one TTSVoiceProfile
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TTSVoiceProfileUpdateArgs>(args: SelectSubset<T, TTSVoiceProfileUpdateArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TTSVoiceProfiles.
     * @param {TTSVoiceProfileDeleteManyArgs} args - Arguments to filter TTSVoiceProfiles to delete.
     * @example
     * // Delete a few TTSVoiceProfiles
     * const { count } = await prisma.tTSVoiceProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TTSVoiceProfileDeleteManyArgs>(args?: SelectSubset<T, TTSVoiceProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TTSVoiceProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TTSVoiceProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TTSVoiceProfiles
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TTSVoiceProfileUpdateManyArgs>(args: SelectSubset<T, TTSVoiceProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TTSVoiceProfiles and returns the data updated in the database.
     * @param {TTSVoiceProfileUpdateManyAndReturnArgs} args - Arguments to update many TTSVoiceProfiles.
     * @example
     * // Update many TTSVoiceProfiles
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TTSVoiceProfiles and only return the `id`
     * const tTSVoiceProfileWithIdOnly = await prisma.tTSVoiceProfile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TTSVoiceProfileUpdateManyAndReturnArgs>(args: SelectSubset<T, TTSVoiceProfileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TTSVoiceProfile.
     * @param {TTSVoiceProfileUpsertArgs} args - Arguments to update or create a TTSVoiceProfile.
     * @example
     * // Update or create a TTSVoiceProfile
     * const tTSVoiceProfile = await prisma.tTSVoiceProfile.upsert({
     *   create: {
     *     // ... data to create a TTSVoiceProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TTSVoiceProfile we want to update
     *   }
     * })
     */
    upsert<T extends TTSVoiceProfileUpsertArgs>(args: SelectSubset<T, TTSVoiceProfileUpsertArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TTSVoiceProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TTSVoiceProfileCountArgs} args - Arguments to filter TTSVoiceProfiles to count.
     * @example
     * // Count the number of TTSVoiceProfiles
     * const count = await prisma.tTSVoiceProfile.count({
     *   where: {
     *     // ... the filter for the TTSVoiceProfiles we want to count
     *   }
     * })
    **/
    count<T extends TTSVoiceProfileCountArgs>(
      args?: Subset<T, TTSVoiceProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TTSVoiceProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TTSVoiceProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TTSVoiceProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TTSVoiceProfileAggregateArgs>(args: Subset<T, TTSVoiceProfileAggregateArgs>): Prisma.PrismaPromise<GetTTSVoiceProfileAggregateType<T>>

    /**
     * Group by TTSVoiceProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TTSVoiceProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TTSVoiceProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TTSVoiceProfileGroupByArgs['orderBy'] }
        : { orderBy?: TTSVoiceProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TTSVoiceProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTTSVoiceProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TTSVoiceProfile model
   */
  readonly fields: TTSVoiceProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TTSVoiceProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TTSVoiceProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    audioFiles<T extends TTSVoiceProfile$audioFilesArgs<ExtArgs> = {}>(args?: Subset<T, TTSVoiceProfile$audioFilesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    voiceBindings<T extends TTSVoiceProfile$voiceBindingsArgs<ExtArgs> = {}>(args?: Subset<T, TTSVoiceProfile$voiceBindingsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TTSVoiceProfile model
   */
  interface TTSVoiceProfileFieldRefs {
    readonly id: FieldRef<"TTSVoiceProfile", 'String'>
    readonly provider: FieldRef<"TTSVoiceProfile", 'String'>
    readonly voiceId: FieldRef<"TTSVoiceProfile", 'String'>
    readonly voiceName: FieldRef<"TTSVoiceProfile", 'String'>
    readonly displayName: FieldRef<"TTSVoiceProfile", 'String'>
    readonly description: FieldRef<"TTSVoiceProfile", 'String'>
    readonly characteristics: FieldRef<"TTSVoiceProfile", 'Json'>
    readonly defaultParameters: FieldRef<"TTSVoiceProfile", 'Json'>
    readonly previewAudio: FieldRef<"TTSVoiceProfile", 'Json'>
    readonly usageCount: FieldRef<"TTSVoiceProfile", 'Int'>
    readonly rating: FieldRef<"TTSVoiceProfile", 'Decimal'>
    readonly isAvailable: FieldRef<"TTSVoiceProfile", 'Boolean'>
    readonly createdAt: FieldRef<"TTSVoiceProfile", 'DateTime'>
    readonly updatedAt: FieldRef<"TTSVoiceProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TTSVoiceProfile findUnique
   */
  export type TTSVoiceProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * Filter, which TTSVoiceProfile to fetch.
     */
    where: TTSVoiceProfileWhereUniqueInput
  }

  /**
   * TTSVoiceProfile findUniqueOrThrow
   */
  export type TTSVoiceProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * Filter, which TTSVoiceProfile to fetch.
     */
    where: TTSVoiceProfileWhereUniqueInput
  }

  /**
   * TTSVoiceProfile findFirst
   */
  export type TTSVoiceProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * Filter, which TTSVoiceProfile to fetch.
     */
    where?: TTSVoiceProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TTSVoiceProfiles to fetch.
     */
    orderBy?: TTSVoiceProfileOrderByWithRelationInput | TTSVoiceProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TTSVoiceProfiles.
     */
    cursor?: TTSVoiceProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TTSVoiceProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TTSVoiceProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TTSVoiceProfiles.
     */
    distinct?: TTSVoiceProfileScalarFieldEnum | TTSVoiceProfileScalarFieldEnum[]
  }

  /**
   * TTSVoiceProfile findFirstOrThrow
   */
  export type TTSVoiceProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * Filter, which TTSVoiceProfile to fetch.
     */
    where?: TTSVoiceProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TTSVoiceProfiles to fetch.
     */
    orderBy?: TTSVoiceProfileOrderByWithRelationInput | TTSVoiceProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TTSVoiceProfiles.
     */
    cursor?: TTSVoiceProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TTSVoiceProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TTSVoiceProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TTSVoiceProfiles.
     */
    distinct?: TTSVoiceProfileScalarFieldEnum | TTSVoiceProfileScalarFieldEnum[]
  }

  /**
   * TTSVoiceProfile findMany
   */
  export type TTSVoiceProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * Filter, which TTSVoiceProfiles to fetch.
     */
    where?: TTSVoiceProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TTSVoiceProfiles to fetch.
     */
    orderBy?: TTSVoiceProfileOrderByWithRelationInput | TTSVoiceProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TTSVoiceProfiles.
     */
    cursor?: TTSVoiceProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TTSVoiceProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TTSVoiceProfiles.
     */
    skip?: number
    distinct?: TTSVoiceProfileScalarFieldEnum | TTSVoiceProfileScalarFieldEnum[]
  }

  /**
   * TTSVoiceProfile create
   */
  export type TTSVoiceProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a TTSVoiceProfile.
     */
    data: XOR<TTSVoiceProfileCreateInput, TTSVoiceProfileUncheckedCreateInput>
  }

  /**
   * TTSVoiceProfile createMany
   */
  export type TTSVoiceProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TTSVoiceProfiles.
     */
    data: TTSVoiceProfileCreateManyInput | TTSVoiceProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TTSVoiceProfile createManyAndReturn
   */
  export type TTSVoiceProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * The data used to create many TTSVoiceProfiles.
     */
    data: TTSVoiceProfileCreateManyInput | TTSVoiceProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TTSVoiceProfile update
   */
  export type TTSVoiceProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a TTSVoiceProfile.
     */
    data: XOR<TTSVoiceProfileUpdateInput, TTSVoiceProfileUncheckedUpdateInput>
    /**
     * Choose, which TTSVoiceProfile to update.
     */
    where: TTSVoiceProfileWhereUniqueInput
  }

  /**
   * TTSVoiceProfile updateMany
   */
  export type TTSVoiceProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TTSVoiceProfiles.
     */
    data: XOR<TTSVoiceProfileUpdateManyMutationInput, TTSVoiceProfileUncheckedUpdateManyInput>
    /**
     * Filter which TTSVoiceProfiles to update
     */
    where?: TTSVoiceProfileWhereInput
    /**
     * Limit how many TTSVoiceProfiles to update.
     */
    limit?: number
  }

  /**
   * TTSVoiceProfile updateManyAndReturn
   */
  export type TTSVoiceProfileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * The data used to update TTSVoiceProfiles.
     */
    data: XOR<TTSVoiceProfileUpdateManyMutationInput, TTSVoiceProfileUncheckedUpdateManyInput>
    /**
     * Filter which TTSVoiceProfiles to update
     */
    where?: TTSVoiceProfileWhereInput
    /**
     * Limit how many TTSVoiceProfiles to update.
     */
    limit?: number
  }

  /**
   * TTSVoiceProfile upsert
   */
  export type TTSVoiceProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the TTSVoiceProfile to update in case it exists.
     */
    where: TTSVoiceProfileWhereUniqueInput
    /**
     * In case the TTSVoiceProfile found by the `where` argument doesn't exist, create a new TTSVoiceProfile with this data.
     */
    create: XOR<TTSVoiceProfileCreateInput, TTSVoiceProfileUncheckedCreateInput>
    /**
     * In case the TTSVoiceProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TTSVoiceProfileUpdateInput, TTSVoiceProfileUncheckedUpdateInput>
  }

  /**
   * TTSVoiceProfile delete
   */
  export type TTSVoiceProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    /**
     * Filter which TTSVoiceProfile to delete.
     */
    where: TTSVoiceProfileWhereUniqueInput
  }

  /**
   * TTSVoiceProfile deleteMany
   */
  export type TTSVoiceProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TTSVoiceProfiles to delete
     */
    where?: TTSVoiceProfileWhereInput
    /**
     * Limit how many TTSVoiceProfiles to delete.
     */
    limit?: number
  }

  /**
   * TTSVoiceProfile.audioFiles
   */
  export type TTSVoiceProfile$audioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    where?: AudioFileWhereInput
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    cursor?: AudioFileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AudioFileScalarFieldEnum | AudioFileScalarFieldEnum[]
  }

  /**
   * TTSVoiceProfile.voiceBindings
   */
  export type TTSVoiceProfile$voiceBindingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    where?: CharacterVoiceBindingWhereInput
    orderBy?: CharacterVoiceBindingOrderByWithRelationInput | CharacterVoiceBindingOrderByWithRelationInput[]
    cursor?: CharacterVoiceBindingWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CharacterVoiceBindingScalarFieldEnum | CharacterVoiceBindingScalarFieldEnum[]
  }

  /**
   * TTSVoiceProfile without action
   */
  export type TTSVoiceProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
  }


  /**
   * Model CharacterVoiceBinding
   */

  export type AggregateCharacterVoiceBinding = {
    _count: CharacterVoiceBindingCountAggregateOutputType | null
    _min: CharacterVoiceBindingMinAggregateOutputType | null
    _max: CharacterVoiceBindingMaxAggregateOutputType | null
  }

  export type CharacterVoiceBindingMinAggregateOutputType = {
    id: string | null
    characterId: string | null
    voiceProfileId: string | null
    isDefault: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CharacterVoiceBindingMaxAggregateOutputType = {
    id: string | null
    characterId: string | null
    voiceProfileId: string | null
    isDefault: boolean | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CharacterVoiceBindingCountAggregateOutputType = {
    id: number
    characterId: number
    voiceProfileId: number
    customParameters: number
    emotionMappings: number
    isDefault: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CharacterVoiceBindingMinAggregateInputType = {
    id?: true
    characterId?: true
    voiceProfileId?: true
    isDefault?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CharacterVoiceBindingMaxAggregateInputType = {
    id?: true
    characterId?: true
    voiceProfileId?: true
    isDefault?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CharacterVoiceBindingCountAggregateInputType = {
    id?: true
    characterId?: true
    voiceProfileId?: true
    customParameters?: true
    emotionMappings?: true
    isDefault?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CharacterVoiceBindingAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterVoiceBinding to aggregate.
     */
    where?: CharacterVoiceBindingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterVoiceBindings to fetch.
     */
    orderBy?: CharacterVoiceBindingOrderByWithRelationInput | CharacterVoiceBindingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CharacterVoiceBindingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterVoiceBindings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterVoiceBindings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CharacterVoiceBindings
    **/
    _count?: true | CharacterVoiceBindingCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CharacterVoiceBindingMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CharacterVoiceBindingMaxAggregateInputType
  }

  export type GetCharacterVoiceBindingAggregateType<T extends CharacterVoiceBindingAggregateArgs> = {
        [P in keyof T & keyof AggregateCharacterVoiceBinding]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCharacterVoiceBinding[P]>
      : GetScalarType<T[P], AggregateCharacterVoiceBinding[P]>
  }




  export type CharacterVoiceBindingGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterVoiceBindingWhereInput
    orderBy?: CharacterVoiceBindingOrderByWithAggregationInput | CharacterVoiceBindingOrderByWithAggregationInput[]
    by: CharacterVoiceBindingScalarFieldEnum[] | CharacterVoiceBindingScalarFieldEnum
    having?: CharacterVoiceBindingScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CharacterVoiceBindingCountAggregateInputType | true
    _min?: CharacterVoiceBindingMinAggregateInputType
    _max?: CharacterVoiceBindingMaxAggregateInputType
  }

  export type CharacterVoiceBindingGroupByOutputType = {
    id: string
    characterId: string
    voiceProfileId: string
    customParameters: JsonValue | null
    emotionMappings: JsonValue
    isDefault: boolean
    createdAt: Date
    updatedAt: Date
    _count: CharacterVoiceBindingCountAggregateOutputType | null
    _min: CharacterVoiceBindingMinAggregateOutputType | null
    _max: CharacterVoiceBindingMaxAggregateOutputType | null
  }

  type GetCharacterVoiceBindingGroupByPayload<T extends CharacterVoiceBindingGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CharacterVoiceBindingGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CharacterVoiceBindingGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CharacterVoiceBindingGroupByOutputType[P]>
            : GetScalarType<T[P], CharacterVoiceBindingGroupByOutputType[P]>
        }
      >
    >


  export type CharacterVoiceBindingSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    characterId?: boolean
    voiceProfileId?: boolean
    customParameters?: boolean
    emotionMappings?: boolean
    isDefault?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    voiceProfile?: boolean | TTSVoiceProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterVoiceBinding"]>

  export type CharacterVoiceBindingSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    characterId?: boolean
    voiceProfileId?: boolean
    customParameters?: boolean
    emotionMappings?: boolean
    isDefault?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    voiceProfile?: boolean | TTSVoiceProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterVoiceBinding"]>

  export type CharacterVoiceBindingSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    characterId?: boolean
    voiceProfileId?: boolean
    customParameters?: boolean
    emotionMappings?: boolean
    isDefault?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    voiceProfile?: boolean | TTSVoiceProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterVoiceBinding"]>

  export type CharacterVoiceBindingSelectScalar = {
    id?: boolean
    characterId?: boolean
    voiceProfileId?: boolean
    customParameters?: boolean
    emotionMappings?: boolean
    isDefault?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CharacterVoiceBindingOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "characterId" | "voiceProfileId" | "customParameters" | "emotionMappings" | "isDefault" | "createdAt" | "updatedAt", ExtArgs["result"]["characterVoiceBinding"]>
  export type CharacterVoiceBindingInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    voiceProfile?: boolean | TTSVoiceProfileDefaultArgs<ExtArgs>
  }
  export type CharacterVoiceBindingIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    voiceProfile?: boolean | TTSVoiceProfileDefaultArgs<ExtArgs>
  }
  export type CharacterVoiceBindingIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    character?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    voiceProfile?: boolean | TTSVoiceProfileDefaultArgs<ExtArgs>
  }

  export type $CharacterVoiceBindingPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CharacterVoiceBinding"
    objects: {
      character: Prisma.$CharacterProfilePayload<ExtArgs>
      voiceProfile: Prisma.$TTSVoiceProfilePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      characterId: string
      voiceProfileId: string
      customParameters: Prisma.JsonValue | null
      emotionMappings: Prisma.JsonValue
      isDefault: boolean
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["characterVoiceBinding"]>
    composites: {}
  }

  type CharacterVoiceBindingGetPayload<S extends boolean | null | undefined | CharacterVoiceBindingDefaultArgs> = $Result.GetResult<Prisma.$CharacterVoiceBindingPayload, S>

  type CharacterVoiceBindingCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CharacterVoiceBindingFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CharacterVoiceBindingCountAggregateInputType | true
    }

  export interface CharacterVoiceBindingDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CharacterVoiceBinding'], meta: { name: 'CharacterVoiceBinding' } }
    /**
     * Find zero or one CharacterVoiceBinding that matches the filter.
     * @param {CharacterVoiceBindingFindUniqueArgs} args - Arguments to find a CharacterVoiceBinding
     * @example
     * // Get one CharacterVoiceBinding
     * const characterVoiceBinding = await prisma.characterVoiceBinding.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CharacterVoiceBindingFindUniqueArgs>(args: SelectSubset<T, CharacterVoiceBindingFindUniqueArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CharacterVoiceBinding that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CharacterVoiceBindingFindUniqueOrThrowArgs} args - Arguments to find a CharacterVoiceBinding
     * @example
     * // Get one CharacterVoiceBinding
     * const characterVoiceBinding = await prisma.characterVoiceBinding.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CharacterVoiceBindingFindUniqueOrThrowArgs>(args: SelectSubset<T, CharacterVoiceBindingFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterVoiceBinding that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterVoiceBindingFindFirstArgs} args - Arguments to find a CharacterVoiceBinding
     * @example
     * // Get one CharacterVoiceBinding
     * const characterVoiceBinding = await prisma.characterVoiceBinding.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CharacterVoiceBindingFindFirstArgs>(args?: SelectSubset<T, CharacterVoiceBindingFindFirstArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterVoiceBinding that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterVoiceBindingFindFirstOrThrowArgs} args - Arguments to find a CharacterVoiceBinding
     * @example
     * // Get one CharacterVoiceBinding
     * const characterVoiceBinding = await prisma.characterVoiceBinding.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CharacterVoiceBindingFindFirstOrThrowArgs>(args?: SelectSubset<T, CharacterVoiceBindingFindFirstOrThrowArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CharacterVoiceBindings that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterVoiceBindingFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CharacterVoiceBindings
     * const characterVoiceBindings = await prisma.characterVoiceBinding.findMany()
     * 
     * // Get first 10 CharacterVoiceBindings
     * const characterVoiceBindings = await prisma.characterVoiceBinding.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const characterVoiceBindingWithIdOnly = await prisma.characterVoiceBinding.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CharacterVoiceBindingFindManyArgs>(args?: SelectSubset<T, CharacterVoiceBindingFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CharacterVoiceBinding.
     * @param {CharacterVoiceBindingCreateArgs} args - Arguments to create a CharacterVoiceBinding.
     * @example
     * // Create one CharacterVoiceBinding
     * const CharacterVoiceBinding = await prisma.characterVoiceBinding.create({
     *   data: {
     *     // ... data to create a CharacterVoiceBinding
     *   }
     * })
     * 
     */
    create<T extends CharacterVoiceBindingCreateArgs>(args: SelectSubset<T, CharacterVoiceBindingCreateArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CharacterVoiceBindings.
     * @param {CharacterVoiceBindingCreateManyArgs} args - Arguments to create many CharacterVoiceBindings.
     * @example
     * // Create many CharacterVoiceBindings
     * const characterVoiceBinding = await prisma.characterVoiceBinding.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CharacterVoiceBindingCreateManyArgs>(args?: SelectSubset<T, CharacterVoiceBindingCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CharacterVoiceBindings and returns the data saved in the database.
     * @param {CharacterVoiceBindingCreateManyAndReturnArgs} args - Arguments to create many CharacterVoiceBindings.
     * @example
     * // Create many CharacterVoiceBindings
     * const characterVoiceBinding = await prisma.characterVoiceBinding.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CharacterVoiceBindings and only return the `id`
     * const characterVoiceBindingWithIdOnly = await prisma.characterVoiceBinding.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CharacterVoiceBindingCreateManyAndReturnArgs>(args?: SelectSubset<T, CharacterVoiceBindingCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CharacterVoiceBinding.
     * @param {CharacterVoiceBindingDeleteArgs} args - Arguments to delete one CharacterVoiceBinding.
     * @example
     * // Delete one CharacterVoiceBinding
     * const CharacterVoiceBinding = await prisma.characterVoiceBinding.delete({
     *   where: {
     *     // ... filter to delete one CharacterVoiceBinding
     *   }
     * })
     * 
     */
    delete<T extends CharacterVoiceBindingDeleteArgs>(args: SelectSubset<T, CharacterVoiceBindingDeleteArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CharacterVoiceBinding.
     * @param {CharacterVoiceBindingUpdateArgs} args - Arguments to update one CharacterVoiceBinding.
     * @example
     * // Update one CharacterVoiceBinding
     * const characterVoiceBinding = await prisma.characterVoiceBinding.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CharacterVoiceBindingUpdateArgs>(args: SelectSubset<T, CharacterVoiceBindingUpdateArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CharacterVoiceBindings.
     * @param {CharacterVoiceBindingDeleteManyArgs} args - Arguments to filter CharacterVoiceBindings to delete.
     * @example
     * // Delete a few CharacterVoiceBindings
     * const { count } = await prisma.characterVoiceBinding.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CharacterVoiceBindingDeleteManyArgs>(args?: SelectSubset<T, CharacterVoiceBindingDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterVoiceBindings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterVoiceBindingUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CharacterVoiceBindings
     * const characterVoiceBinding = await prisma.characterVoiceBinding.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CharacterVoiceBindingUpdateManyArgs>(args: SelectSubset<T, CharacterVoiceBindingUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterVoiceBindings and returns the data updated in the database.
     * @param {CharacterVoiceBindingUpdateManyAndReturnArgs} args - Arguments to update many CharacterVoiceBindings.
     * @example
     * // Update many CharacterVoiceBindings
     * const characterVoiceBinding = await prisma.characterVoiceBinding.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CharacterVoiceBindings and only return the `id`
     * const characterVoiceBindingWithIdOnly = await prisma.characterVoiceBinding.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CharacterVoiceBindingUpdateManyAndReturnArgs>(args: SelectSubset<T, CharacterVoiceBindingUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CharacterVoiceBinding.
     * @param {CharacterVoiceBindingUpsertArgs} args - Arguments to update or create a CharacterVoiceBinding.
     * @example
     * // Update or create a CharacterVoiceBinding
     * const characterVoiceBinding = await prisma.characterVoiceBinding.upsert({
     *   create: {
     *     // ... data to create a CharacterVoiceBinding
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CharacterVoiceBinding we want to update
     *   }
     * })
     */
    upsert<T extends CharacterVoiceBindingUpsertArgs>(args: SelectSubset<T, CharacterVoiceBindingUpsertArgs<ExtArgs>>): Prisma__CharacterVoiceBindingClient<$Result.GetResult<Prisma.$CharacterVoiceBindingPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CharacterVoiceBindings.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterVoiceBindingCountArgs} args - Arguments to filter CharacterVoiceBindings to count.
     * @example
     * // Count the number of CharacterVoiceBindings
     * const count = await prisma.characterVoiceBinding.count({
     *   where: {
     *     // ... the filter for the CharacterVoiceBindings we want to count
     *   }
     * })
    **/
    count<T extends CharacterVoiceBindingCountArgs>(
      args?: Subset<T, CharacterVoiceBindingCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CharacterVoiceBindingCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CharacterVoiceBinding.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterVoiceBindingAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CharacterVoiceBindingAggregateArgs>(args: Subset<T, CharacterVoiceBindingAggregateArgs>): Prisma.PrismaPromise<GetCharacterVoiceBindingAggregateType<T>>

    /**
     * Group by CharacterVoiceBinding.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterVoiceBindingGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CharacterVoiceBindingGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CharacterVoiceBindingGroupByArgs['orderBy'] }
        : { orderBy?: CharacterVoiceBindingGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CharacterVoiceBindingGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCharacterVoiceBindingGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CharacterVoiceBinding model
   */
  readonly fields: CharacterVoiceBindingFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CharacterVoiceBinding.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CharacterVoiceBindingClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    character<T extends CharacterProfileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfileDefaultArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    voiceProfile<T extends TTSVoiceProfileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TTSVoiceProfileDefaultArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CharacterVoiceBinding model
   */
  interface CharacterVoiceBindingFieldRefs {
    readonly id: FieldRef<"CharacterVoiceBinding", 'String'>
    readonly characterId: FieldRef<"CharacterVoiceBinding", 'String'>
    readonly voiceProfileId: FieldRef<"CharacterVoiceBinding", 'String'>
    readonly customParameters: FieldRef<"CharacterVoiceBinding", 'Json'>
    readonly emotionMappings: FieldRef<"CharacterVoiceBinding", 'Json'>
    readonly isDefault: FieldRef<"CharacterVoiceBinding", 'Boolean'>
    readonly createdAt: FieldRef<"CharacterVoiceBinding", 'DateTime'>
    readonly updatedAt: FieldRef<"CharacterVoiceBinding", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CharacterVoiceBinding findUnique
   */
  export type CharacterVoiceBindingFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * Filter, which CharacterVoiceBinding to fetch.
     */
    where: CharacterVoiceBindingWhereUniqueInput
  }

  /**
   * CharacterVoiceBinding findUniqueOrThrow
   */
  export type CharacterVoiceBindingFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * Filter, which CharacterVoiceBinding to fetch.
     */
    where: CharacterVoiceBindingWhereUniqueInput
  }

  /**
   * CharacterVoiceBinding findFirst
   */
  export type CharacterVoiceBindingFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * Filter, which CharacterVoiceBinding to fetch.
     */
    where?: CharacterVoiceBindingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterVoiceBindings to fetch.
     */
    orderBy?: CharacterVoiceBindingOrderByWithRelationInput | CharacterVoiceBindingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterVoiceBindings.
     */
    cursor?: CharacterVoiceBindingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterVoiceBindings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterVoiceBindings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterVoiceBindings.
     */
    distinct?: CharacterVoiceBindingScalarFieldEnum | CharacterVoiceBindingScalarFieldEnum[]
  }

  /**
   * CharacterVoiceBinding findFirstOrThrow
   */
  export type CharacterVoiceBindingFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * Filter, which CharacterVoiceBinding to fetch.
     */
    where?: CharacterVoiceBindingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterVoiceBindings to fetch.
     */
    orderBy?: CharacterVoiceBindingOrderByWithRelationInput | CharacterVoiceBindingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterVoiceBindings.
     */
    cursor?: CharacterVoiceBindingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterVoiceBindings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterVoiceBindings.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterVoiceBindings.
     */
    distinct?: CharacterVoiceBindingScalarFieldEnum | CharacterVoiceBindingScalarFieldEnum[]
  }

  /**
   * CharacterVoiceBinding findMany
   */
  export type CharacterVoiceBindingFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * Filter, which CharacterVoiceBindings to fetch.
     */
    where?: CharacterVoiceBindingWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterVoiceBindings to fetch.
     */
    orderBy?: CharacterVoiceBindingOrderByWithRelationInput | CharacterVoiceBindingOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CharacterVoiceBindings.
     */
    cursor?: CharacterVoiceBindingWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterVoiceBindings from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterVoiceBindings.
     */
    skip?: number
    distinct?: CharacterVoiceBindingScalarFieldEnum | CharacterVoiceBindingScalarFieldEnum[]
  }

  /**
   * CharacterVoiceBinding create
   */
  export type CharacterVoiceBindingCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * The data needed to create a CharacterVoiceBinding.
     */
    data: XOR<CharacterVoiceBindingCreateInput, CharacterVoiceBindingUncheckedCreateInput>
  }

  /**
   * CharacterVoiceBinding createMany
   */
  export type CharacterVoiceBindingCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CharacterVoiceBindings.
     */
    data: CharacterVoiceBindingCreateManyInput | CharacterVoiceBindingCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CharacterVoiceBinding createManyAndReturn
   */
  export type CharacterVoiceBindingCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * The data used to create many CharacterVoiceBindings.
     */
    data: CharacterVoiceBindingCreateManyInput | CharacterVoiceBindingCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterVoiceBinding update
   */
  export type CharacterVoiceBindingUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * The data needed to update a CharacterVoiceBinding.
     */
    data: XOR<CharacterVoiceBindingUpdateInput, CharacterVoiceBindingUncheckedUpdateInput>
    /**
     * Choose, which CharacterVoiceBinding to update.
     */
    where: CharacterVoiceBindingWhereUniqueInput
  }

  /**
   * CharacterVoiceBinding updateMany
   */
  export type CharacterVoiceBindingUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CharacterVoiceBindings.
     */
    data: XOR<CharacterVoiceBindingUpdateManyMutationInput, CharacterVoiceBindingUncheckedUpdateManyInput>
    /**
     * Filter which CharacterVoiceBindings to update
     */
    where?: CharacterVoiceBindingWhereInput
    /**
     * Limit how many CharacterVoiceBindings to update.
     */
    limit?: number
  }

  /**
   * CharacterVoiceBinding updateManyAndReturn
   */
  export type CharacterVoiceBindingUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * The data used to update CharacterVoiceBindings.
     */
    data: XOR<CharacterVoiceBindingUpdateManyMutationInput, CharacterVoiceBindingUncheckedUpdateManyInput>
    /**
     * Filter which CharacterVoiceBindings to update
     */
    where?: CharacterVoiceBindingWhereInput
    /**
     * Limit how many CharacterVoiceBindings to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterVoiceBinding upsert
   */
  export type CharacterVoiceBindingUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * The filter to search for the CharacterVoiceBinding to update in case it exists.
     */
    where: CharacterVoiceBindingWhereUniqueInput
    /**
     * In case the CharacterVoiceBinding found by the `where` argument doesn't exist, create a new CharacterVoiceBinding with this data.
     */
    create: XOR<CharacterVoiceBindingCreateInput, CharacterVoiceBindingUncheckedCreateInput>
    /**
     * In case the CharacterVoiceBinding was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CharacterVoiceBindingUpdateInput, CharacterVoiceBindingUncheckedUpdateInput>
  }

  /**
   * CharacterVoiceBinding delete
   */
  export type CharacterVoiceBindingDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
    /**
     * Filter which CharacterVoiceBinding to delete.
     */
    where: CharacterVoiceBindingWhereUniqueInput
  }

  /**
   * CharacterVoiceBinding deleteMany
   */
  export type CharacterVoiceBindingDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterVoiceBindings to delete
     */
    where?: CharacterVoiceBindingWhereInput
    /**
     * Limit how many CharacterVoiceBindings to delete.
     */
    limit?: number
  }

  /**
   * CharacterVoiceBinding without action
   */
  export type CharacterVoiceBindingDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterVoiceBinding
     */
    select?: CharacterVoiceBindingSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterVoiceBinding
     */
    omit?: CharacterVoiceBindingOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterVoiceBindingInclude<ExtArgs> | null
  }


  /**
   * Model TextSegment
   */

  export type AggregateTextSegment = {
    _count: TextSegmentCountAggregateOutputType | null
    _avg: TextSegmentAvgAggregateOutputType | null
    _sum: TextSegmentSumAggregateOutputType | null
    _min: TextSegmentMinAggregateOutputType | null
    _max: TextSegmentMaxAggregateOutputType | null
  }

  export type TextSegmentAvgAggregateOutputType = {
    segmentIndex: number | null
    startPosition: number | null
    endPosition: number | null
    wordCount: number | null
    orderIndex: number | null
  }

  export type TextSegmentSumAggregateOutputType = {
    segmentIndex: number | null
    startPosition: number | null
    endPosition: number | null
    wordCount: number | null
    orderIndex: number | null
  }

  export type TextSegmentMinAggregateOutputType = {
    id: string | null
    bookId: string | null
    segmentIndex: number | null
    startPosition: number | null
    endPosition: number | null
    content: string | null
    wordCount: number | null
    segmentType: string | null
    orderIndex: number | null
    status: string | null
    createdAt: Date | null
  }

  export type TextSegmentMaxAggregateOutputType = {
    id: string | null
    bookId: string | null
    segmentIndex: number | null
    startPosition: number | null
    endPosition: number | null
    content: string | null
    wordCount: number | null
    segmentType: string | null
    orderIndex: number | null
    status: string | null
    createdAt: Date | null
  }

  export type TextSegmentCountAggregateOutputType = {
    id: number
    bookId: number
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: number
    wordCount: number
    segmentType: number
    orderIndex: number
    metadata: number
    status: number
    createdAt: number
    _all: number
  }


  export type TextSegmentAvgAggregateInputType = {
    segmentIndex?: true
    startPosition?: true
    endPosition?: true
    wordCount?: true
    orderIndex?: true
  }

  export type TextSegmentSumAggregateInputType = {
    segmentIndex?: true
    startPosition?: true
    endPosition?: true
    wordCount?: true
    orderIndex?: true
  }

  export type TextSegmentMinAggregateInputType = {
    id?: true
    bookId?: true
    segmentIndex?: true
    startPosition?: true
    endPosition?: true
    content?: true
    wordCount?: true
    segmentType?: true
    orderIndex?: true
    status?: true
    createdAt?: true
  }

  export type TextSegmentMaxAggregateInputType = {
    id?: true
    bookId?: true
    segmentIndex?: true
    startPosition?: true
    endPosition?: true
    content?: true
    wordCount?: true
    segmentType?: true
    orderIndex?: true
    status?: true
    createdAt?: true
  }

  export type TextSegmentCountAggregateInputType = {
    id?: true
    bookId?: true
    segmentIndex?: true
    startPosition?: true
    endPosition?: true
    content?: true
    wordCount?: true
    segmentType?: true
    orderIndex?: true
    metadata?: true
    status?: true
    createdAt?: true
    _all?: true
  }

  export type TextSegmentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TextSegment to aggregate.
     */
    where?: TextSegmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TextSegments to fetch.
     */
    orderBy?: TextSegmentOrderByWithRelationInput | TextSegmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TextSegmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TextSegments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TextSegments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TextSegments
    **/
    _count?: true | TextSegmentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TextSegmentAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TextSegmentSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TextSegmentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TextSegmentMaxAggregateInputType
  }

  export type GetTextSegmentAggregateType<T extends TextSegmentAggregateArgs> = {
        [P in keyof T & keyof AggregateTextSegment]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTextSegment[P]>
      : GetScalarType<T[P], AggregateTextSegment[P]>
  }




  export type TextSegmentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TextSegmentWhereInput
    orderBy?: TextSegmentOrderByWithAggregationInput | TextSegmentOrderByWithAggregationInput[]
    by: TextSegmentScalarFieldEnum[] | TextSegmentScalarFieldEnum
    having?: TextSegmentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TextSegmentCountAggregateInputType | true
    _avg?: TextSegmentAvgAggregateInputType
    _sum?: TextSegmentSumAggregateInputType
    _min?: TextSegmentMinAggregateInputType
    _max?: TextSegmentMaxAggregateInputType
  }

  export type TextSegmentGroupByOutputType = {
    id: string
    bookId: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount: number | null
    segmentType: string | null
    orderIndex: number
    metadata: JsonValue | null
    status: string
    createdAt: Date
    _count: TextSegmentCountAggregateOutputType | null
    _avg: TextSegmentAvgAggregateOutputType | null
    _sum: TextSegmentSumAggregateOutputType | null
    _min: TextSegmentMinAggregateOutputType | null
    _max: TextSegmentMaxAggregateOutputType | null
  }

  type GetTextSegmentGroupByPayload<T extends TextSegmentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TextSegmentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TextSegmentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TextSegmentGroupByOutputType[P]>
            : GetScalarType<T[P], TextSegmentGroupByOutputType[P]>
        }
      >
    >


  export type TextSegmentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    segmentIndex?: boolean
    startPosition?: boolean
    endPosition?: boolean
    content?: boolean
    wordCount?: boolean
    segmentType?: boolean
    orderIndex?: boolean
    metadata?: boolean
    status?: boolean
    createdAt?: boolean
    audioFiles?: boolean | TextSegment$audioFilesArgs<ExtArgs>
    scriptSentences?: boolean | TextSegment$scriptSentencesArgs<ExtArgs>
    book?: boolean | BookDefaultArgs<ExtArgs>
    _count?: boolean | TextSegmentCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["textSegment"]>

  export type TextSegmentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    segmentIndex?: boolean
    startPosition?: boolean
    endPosition?: boolean
    content?: boolean
    wordCount?: boolean
    segmentType?: boolean
    orderIndex?: boolean
    metadata?: boolean
    status?: boolean
    createdAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["textSegment"]>

  export type TextSegmentSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    segmentIndex?: boolean
    startPosition?: boolean
    endPosition?: boolean
    content?: boolean
    wordCount?: boolean
    segmentType?: boolean
    orderIndex?: boolean
    metadata?: boolean
    status?: boolean
    createdAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["textSegment"]>

  export type TextSegmentSelectScalar = {
    id?: boolean
    bookId?: boolean
    segmentIndex?: boolean
    startPosition?: boolean
    endPosition?: boolean
    content?: boolean
    wordCount?: boolean
    segmentType?: boolean
    orderIndex?: boolean
    metadata?: boolean
    status?: boolean
    createdAt?: boolean
  }

  export type TextSegmentOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bookId" | "segmentIndex" | "startPosition" | "endPosition" | "content" | "wordCount" | "segmentType" | "orderIndex" | "metadata" | "status" | "createdAt", ExtArgs["result"]["textSegment"]>
  export type TextSegmentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | TextSegment$audioFilesArgs<ExtArgs>
    scriptSentences?: boolean | TextSegment$scriptSentencesArgs<ExtArgs>
    book?: boolean | BookDefaultArgs<ExtArgs>
    _count?: boolean | TextSegmentCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type TextSegmentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
  }
  export type TextSegmentIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
  }

  export type $TextSegmentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TextSegment"
    objects: {
      audioFiles: Prisma.$AudioFilePayload<ExtArgs>[]
      scriptSentences: Prisma.$ScriptSentencePayload<ExtArgs>[]
      book: Prisma.$BookPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bookId: string
      segmentIndex: number
      startPosition: number
      endPosition: number
      content: string
      wordCount: number | null
      segmentType: string | null
      orderIndex: number
      metadata: Prisma.JsonValue | null
      status: string
      createdAt: Date
    }, ExtArgs["result"]["textSegment"]>
    composites: {}
  }

  type TextSegmentGetPayload<S extends boolean | null | undefined | TextSegmentDefaultArgs> = $Result.GetResult<Prisma.$TextSegmentPayload, S>

  type TextSegmentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TextSegmentFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TextSegmentCountAggregateInputType | true
    }

  export interface TextSegmentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TextSegment'], meta: { name: 'TextSegment' } }
    /**
     * Find zero or one TextSegment that matches the filter.
     * @param {TextSegmentFindUniqueArgs} args - Arguments to find a TextSegment
     * @example
     * // Get one TextSegment
     * const textSegment = await prisma.textSegment.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TextSegmentFindUniqueArgs>(args: SelectSubset<T, TextSegmentFindUniqueArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one TextSegment that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TextSegmentFindUniqueOrThrowArgs} args - Arguments to find a TextSegment
     * @example
     * // Get one TextSegment
     * const textSegment = await prisma.textSegment.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TextSegmentFindUniqueOrThrowArgs>(args: SelectSubset<T, TextSegmentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TextSegment that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TextSegmentFindFirstArgs} args - Arguments to find a TextSegment
     * @example
     * // Get one TextSegment
     * const textSegment = await prisma.textSegment.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TextSegmentFindFirstArgs>(args?: SelectSubset<T, TextSegmentFindFirstArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first TextSegment that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TextSegmentFindFirstOrThrowArgs} args - Arguments to find a TextSegment
     * @example
     * // Get one TextSegment
     * const textSegment = await prisma.textSegment.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TextSegmentFindFirstOrThrowArgs>(args?: SelectSubset<T, TextSegmentFindFirstOrThrowArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more TextSegments that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TextSegmentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TextSegments
     * const textSegments = await prisma.textSegment.findMany()
     * 
     * // Get first 10 TextSegments
     * const textSegments = await prisma.textSegment.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const textSegmentWithIdOnly = await prisma.textSegment.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TextSegmentFindManyArgs>(args?: SelectSubset<T, TextSegmentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a TextSegment.
     * @param {TextSegmentCreateArgs} args - Arguments to create a TextSegment.
     * @example
     * // Create one TextSegment
     * const TextSegment = await prisma.textSegment.create({
     *   data: {
     *     // ... data to create a TextSegment
     *   }
     * })
     * 
     */
    create<T extends TextSegmentCreateArgs>(args: SelectSubset<T, TextSegmentCreateArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many TextSegments.
     * @param {TextSegmentCreateManyArgs} args - Arguments to create many TextSegments.
     * @example
     * // Create many TextSegments
     * const textSegment = await prisma.textSegment.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TextSegmentCreateManyArgs>(args?: SelectSubset<T, TextSegmentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TextSegments and returns the data saved in the database.
     * @param {TextSegmentCreateManyAndReturnArgs} args - Arguments to create many TextSegments.
     * @example
     * // Create many TextSegments
     * const textSegment = await prisma.textSegment.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TextSegments and only return the `id`
     * const textSegmentWithIdOnly = await prisma.textSegment.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TextSegmentCreateManyAndReturnArgs>(args?: SelectSubset<T, TextSegmentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a TextSegment.
     * @param {TextSegmentDeleteArgs} args - Arguments to delete one TextSegment.
     * @example
     * // Delete one TextSegment
     * const TextSegment = await prisma.textSegment.delete({
     *   where: {
     *     // ... filter to delete one TextSegment
     *   }
     * })
     * 
     */
    delete<T extends TextSegmentDeleteArgs>(args: SelectSubset<T, TextSegmentDeleteArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one TextSegment.
     * @param {TextSegmentUpdateArgs} args - Arguments to update one TextSegment.
     * @example
     * // Update one TextSegment
     * const textSegment = await prisma.textSegment.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TextSegmentUpdateArgs>(args: SelectSubset<T, TextSegmentUpdateArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more TextSegments.
     * @param {TextSegmentDeleteManyArgs} args - Arguments to filter TextSegments to delete.
     * @example
     * // Delete a few TextSegments
     * const { count } = await prisma.textSegment.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TextSegmentDeleteManyArgs>(args?: SelectSubset<T, TextSegmentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TextSegments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TextSegmentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TextSegments
     * const textSegment = await prisma.textSegment.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TextSegmentUpdateManyArgs>(args: SelectSubset<T, TextSegmentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TextSegments and returns the data updated in the database.
     * @param {TextSegmentUpdateManyAndReturnArgs} args - Arguments to update many TextSegments.
     * @example
     * // Update many TextSegments
     * const textSegment = await prisma.textSegment.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more TextSegments and only return the `id`
     * const textSegmentWithIdOnly = await prisma.textSegment.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TextSegmentUpdateManyAndReturnArgs>(args: SelectSubset<T, TextSegmentUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one TextSegment.
     * @param {TextSegmentUpsertArgs} args - Arguments to update or create a TextSegment.
     * @example
     * // Update or create a TextSegment
     * const textSegment = await prisma.textSegment.upsert({
     *   create: {
     *     // ... data to create a TextSegment
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TextSegment we want to update
     *   }
     * })
     */
    upsert<T extends TextSegmentUpsertArgs>(args: SelectSubset<T, TextSegmentUpsertArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of TextSegments.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TextSegmentCountArgs} args - Arguments to filter TextSegments to count.
     * @example
     * // Count the number of TextSegments
     * const count = await prisma.textSegment.count({
     *   where: {
     *     // ... the filter for the TextSegments we want to count
     *   }
     * })
    **/
    count<T extends TextSegmentCountArgs>(
      args?: Subset<T, TextSegmentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TextSegmentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TextSegment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TextSegmentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TextSegmentAggregateArgs>(args: Subset<T, TextSegmentAggregateArgs>): Prisma.PrismaPromise<GetTextSegmentAggregateType<T>>

    /**
     * Group by TextSegment.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TextSegmentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TextSegmentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TextSegmentGroupByArgs['orderBy'] }
        : { orderBy?: TextSegmentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TextSegmentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTextSegmentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TextSegment model
   */
  readonly fields: TextSegmentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TextSegment.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TextSegmentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    audioFiles<T extends TextSegment$audioFilesArgs<ExtArgs> = {}>(args?: Subset<T, TextSegment$audioFilesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    scriptSentences<T extends TextSegment$scriptSentencesArgs<ExtArgs> = {}>(args?: Subset<T, TextSegment$scriptSentencesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    book<T extends BookDefaultArgs<ExtArgs> = {}>(args?: Subset<T, BookDefaultArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TextSegment model
   */
  interface TextSegmentFieldRefs {
    readonly id: FieldRef<"TextSegment", 'String'>
    readonly bookId: FieldRef<"TextSegment", 'String'>
    readonly segmentIndex: FieldRef<"TextSegment", 'Int'>
    readonly startPosition: FieldRef<"TextSegment", 'Int'>
    readonly endPosition: FieldRef<"TextSegment", 'Int'>
    readonly content: FieldRef<"TextSegment", 'String'>
    readonly wordCount: FieldRef<"TextSegment", 'Int'>
    readonly segmentType: FieldRef<"TextSegment", 'String'>
    readonly orderIndex: FieldRef<"TextSegment", 'Int'>
    readonly metadata: FieldRef<"TextSegment", 'Json'>
    readonly status: FieldRef<"TextSegment", 'String'>
    readonly createdAt: FieldRef<"TextSegment", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TextSegment findUnique
   */
  export type TextSegmentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * Filter, which TextSegment to fetch.
     */
    where: TextSegmentWhereUniqueInput
  }

  /**
   * TextSegment findUniqueOrThrow
   */
  export type TextSegmentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * Filter, which TextSegment to fetch.
     */
    where: TextSegmentWhereUniqueInput
  }

  /**
   * TextSegment findFirst
   */
  export type TextSegmentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * Filter, which TextSegment to fetch.
     */
    where?: TextSegmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TextSegments to fetch.
     */
    orderBy?: TextSegmentOrderByWithRelationInput | TextSegmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TextSegments.
     */
    cursor?: TextSegmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TextSegments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TextSegments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TextSegments.
     */
    distinct?: TextSegmentScalarFieldEnum | TextSegmentScalarFieldEnum[]
  }

  /**
   * TextSegment findFirstOrThrow
   */
  export type TextSegmentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * Filter, which TextSegment to fetch.
     */
    where?: TextSegmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TextSegments to fetch.
     */
    orderBy?: TextSegmentOrderByWithRelationInput | TextSegmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TextSegments.
     */
    cursor?: TextSegmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TextSegments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TextSegments.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TextSegments.
     */
    distinct?: TextSegmentScalarFieldEnum | TextSegmentScalarFieldEnum[]
  }

  /**
   * TextSegment findMany
   */
  export type TextSegmentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * Filter, which TextSegments to fetch.
     */
    where?: TextSegmentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TextSegments to fetch.
     */
    orderBy?: TextSegmentOrderByWithRelationInput | TextSegmentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TextSegments.
     */
    cursor?: TextSegmentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TextSegments from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TextSegments.
     */
    skip?: number
    distinct?: TextSegmentScalarFieldEnum | TextSegmentScalarFieldEnum[]
  }

  /**
   * TextSegment create
   */
  export type TextSegmentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * The data needed to create a TextSegment.
     */
    data: XOR<TextSegmentCreateInput, TextSegmentUncheckedCreateInput>
  }

  /**
   * TextSegment createMany
   */
  export type TextSegmentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TextSegments.
     */
    data: TextSegmentCreateManyInput | TextSegmentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TextSegment createManyAndReturn
   */
  export type TextSegmentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * The data used to create many TextSegments.
     */
    data: TextSegmentCreateManyInput | TextSegmentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * TextSegment update
   */
  export type TextSegmentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * The data needed to update a TextSegment.
     */
    data: XOR<TextSegmentUpdateInput, TextSegmentUncheckedUpdateInput>
    /**
     * Choose, which TextSegment to update.
     */
    where: TextSegmentWhereUniqueInput
  }

  /**
   * TextSegment updateMany
   */
  export type TextSegmentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TextSegments.
     */
    data: XOR<TextSegmentUpdateManyMutationInput, TextSegmentUncheckedUpdateManyInput>
    /**
     * Filter which TextSegments to update
     */
    where?: TextSegmentWhereInput
    /**
     * Limit how many TextSegments to update.
     */
    limit?: number
  }

  /**
   * TextSegment updateManyAndReturn
   */
  export type TextSegmentUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * The data used to update TextSegments.
     */
    data: XOR<TextSegmentUpdateManyMutationInput, TextSegmentUncheckedUpdateManyInput>
    /**
     * Filter which TextSegments to update
     */
    where?: TextSegmentWhereInput
    /**
     * Limit how many TextSegments to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * TextSegment upsert
   */
  export type TextSegmentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * The filter to search for the TextSegment to update in case it exists.
     */
    where: TextSegmentWhereUniqueInput
    /**
     * In case the TextSegment found by the `where` argument doesn't exist, create a new TextSegment with this data.
     */
    create: XOR<TextSegmentCreateInput, TextSegmentUncheckedCreateInput>
    /**
     * In case the TextSegment was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TextSegmentUpdateInput, TextSegmentUncheckedUpdateInput>
  }

  /**
   * TextSegment delete
   */
  export type TextSegmentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    /**
     * Filter which TextSegment to delete.
     */
    where: TextSegmentWhereUniqueInput
  }

  /**
   * TextSegment deleteMany
   */
  export type TextSegmentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TextSegments to delete
     */
    where?: TextSegmentWhereInput
    /**
     * Limit how many TextSegments to delete.
     */
    limit?: number
  }

  /**
   * TextSegment.audioFiles
   */
  export type TextSegment$audioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    where?: AudioFileWhereInput
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    cursor?: AudioFileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AudioFileScalarFieldEnum | AudioFileScalarFieldEnum[]
  }

  /**
   * TextSegment.scriptSentences
   */
  export type TextSegment$scriptSentencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    where?: ScriptSentenceWhereInput
    orderBy?: ScriptSentenceOrderByWithRelationInput | ScriptSentenceOrderByWithRelationInput[]
    cursor?: ScriptSentenceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ScriptSentenceScalarFieldEnum | ScriptSentenceScalarFieldEnum[]
  }

  /**
   * TextSegment without action
   */
  export type TextSegmentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
  }


  /**
   * Model ScriptSentence
   */

  export type AggregateScriptSentence = {
    _count: ScriptSentenceCountAggregateOutputType | null
    _avg: ScriptSentenceAvgAggregateOutputType | null
    _sum: ScriptSentenceSumAggregateOutputType | null
    _min: ScriptSentenceMinAggregateOutputType | null
    _max: ScriptSentenceMaxAggregateOutputType | null
  }

  export type ScriptSentenceAvgAggregateOutputType = {
    orderInSegment: number | null
    strength: number | null
    pauseAfter: Decimal | null
  }

  export type ScriptSentenceSumAggregateOutputType = {
    orderInSegment: number | null
    strength: number | null
    pauseAfter: Decimal | null
  }

  export type ScriptSentenceMinAggregateOutputType = {
    id: string | null
    bookId: string | null
    segmentId: string | null
    characterId: string | null
    rawSpeaker: string | null
    text: string | null
    orderInSegment: number | null
    tone: string | null
    strength: number | null
    pauseAfter: Decimal | null
    createdAt: Date | null
  }

  export type ScriptSentenceMaxAggregateOutputType = {
    id: string | null
    bookId: string | null
    segmentId: string | null
    characterId: string | null
    rawSpeaker: string | null
    text: string | null
    orderInSegment: number | null
    tone: string | null
    strength: number | null
    pauseAfter: Decimal | null
    createdAt: Date | null
  }

  export type ScriptSentenceCountAggregateOutputType = {
    id: number
    bookId: number
    segmentId: number
    characterId: number
    rawSpeaker: number
    text: number
    orderInSegment: number
    tone: number
    strength: number
    pauseAfter: number
    ttsParameters: number
    createdAt: number
    _all: number
  }


  export type ScriptSentenceAvgAggregateInputType = {
    orderInSegment?: true
    strength?: true
    pauseAfter?: true
  }

  export type ScriptSentenceSumAggregateInputType = {
    orderInSegment?: true
    strength?: true
    pauseAfter?: true
  }

  export type ScriptSentenceMinAggregateInputType = {
    id?: true
    bookId?: true
    segmentId?: true
    characterId?: true
    rawSpeaker?: true
    text?: true
    orderInSegment?: true
    tone?: true
    strength?: true
    pauseAfter?: true
    createdAt?: true
  }

  export type ScriptSentenceMaxAggregateInputType = {
    id?: true
    bookId?: true
    segmentId?: true
    characterId?: true
    rawSpeaker?: true
    text?: true
    orderInSegment?: true
    tone?: true
    strength?: true
    pauseAfter?: true
    createdAt?: true
  }

  export type ScriptSentenceCountAggregateInputType = {
    id?: true
    bookId?: true
    segmentId?: true
    characterId?: true
    rawSpeaker?: true
    text?: true
    orderInSegment?: true
    tone?: true
    strength?: true
    pauseAfter?: true
    ttsParameters?: true
    createdAt?: true
    _all?: true
  }

  export type ScriptSentenceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ScriptSentence to aggregate.
     */
    where?: ScriptSentenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ScriptSentences to fetch.
     */
    orderBy?: ScriptSentenceOrderByWithRelationInput | ScriptSentenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ScriptSentenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ScriptSentences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ScriptSentences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ScriptSentences
    **/
    _count?: true | ScriptSentenceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ScriptSentenceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ScriptSentenceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ScriptSentenceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ScriptSentenceMaxAggregateInputType
  }

  export type GetScriptSentenceAggregateType<T extends ScriptSentenceAggregateArgs> = {
        [P in keyof T & keyof AggregateScriptSentence]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateScriptSentence[P]>
      : GetScalarType<T[P], AggregateScriptSentence[P]>
  }




  export type ScriptSentenceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ScriptSentenceWhereInput
    orderBy?: ScriptSentenceOrderByWithAggregationInput | ScriptSentenceOrderByWithAggregationInput[]
    by: ScriptSentenceScalarFieldEnum[] | ScriptSentenceScalarFieldEnum
    having?: ScriptSentenceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ScriptSentenceCountAggregateInputType | true
    _avg?: ScriptSentenceAvgAggregateInputType
    _sum?: ScriptSentenceSumAggregateInputType
    _min?: ScriptSentenceMinAggregateInputType
    _max?: ScriptSentenceMaxAggregateInputType
  }

  export type ScriptSentenceGroupByOutputType = {
    id: string
    bookId: string
    segmentId: string
    characterId: string | null
    rawSpeaker: string | null
    text: string
    orderInSegment: number
    tone: string | null
    strength: number | null
    pauseAfter: Decimal | null
    ttsParameters: JsonValue | null
    createdAt: Date
    _count: ScriptSentenceCountAggregateOutputType | null
    _avg: ScriptSentenceAvgAggregateOutputType | null
    _sum: ScriptSentenceSumAggregateOutputType | null
    _min: ScriptSentenceMinAggregateOutputType | null
    _max: ScriptSentenceMaxAggregateOutputType | null
  }

  type GetScriptSentenceGroupByPayload<T extends ScriptSentenceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ScriptSentenceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ScriptSentenceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ScriptSentenceGroupByOutputType[P]>
            : GetScalarType<T[P], ScriptSentenceGroupByOutputType[P]>
        }
      >
    >


  export type ScriptSentenceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    segmentId?: boolean
    characterId?: boolean
    rawSpeaker?: boolean
    text?: boolean
    orderInSegment?: boolean
    tone?: boolean
    strength?: boolean
    pauseAfter?: boolean
    ttsParameters?: boolean
    createdAt?: boolean
    audioFiles?: boolean | ScriptSentence$audioFilesArgs<ExtArgs>
    book?: boolean | BookDefaultArgs<ExtArgs>
    character?: boolean | ScriptSentence$characterArgs<ExtArgs>
    segment?: boolean | TextSegmentDefaultArgs<ExtArgs>
    _count?: boolean | ScriptSentenceCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["scriptSentence"]>

  export type ScriptSentenceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    segmentId?: boolean
    characterId?: boolean
    rawSpeaker?: boolean
    text?: boolean
    orderInSegment?: boolean
    tone?: boolean
    strength?: boolean
    pauseAfter?: boolean
    ttsParameters?: boolean
    createdAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    character?: boolean | ScriptSentence$characterArgs<ExtArgs>
    segment?: boolean | TextSegmentDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["scriptSentence"]>

  export type ScriptSentenceSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    segmentId?: boolean
    characterId?: boolean
    rawSpeaker?: boolean
    text?: boolean
    orderInSegment?: boolean
    tone?: boolean
    strength?: boolean
    pauseAfter?: boolean
    ttsParameters?: boolean
    createdAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    character?: boolean | ScriptSentence$characterArgs<ExtArgs>
    segment?: boolean | TextSegmentDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["scriptSentence"]>

  export type ScriptSentenceSelectScalar = {
    id?: boolean
    bookId?: boolean
    segmentId?: boolean
    characterId?: boolean
    rawSpeaker?: boolean
    text?: boolean
    orderInSegment?: boolean
    tone?: boolean
    strength?: boolean
    pauseAfter?: boolean
    ttsParameters?: boolean
    createdAt?: boolean
  }

  export type ScriptSentenceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bookId" | "segmentId" | "characterId" | "rawSpeaker" | "text" | "orderInSegment" | "tone" | "strength" | "pauseAfter" | "ttsParameters" | "createdAt", ExtArgs["result"]["scriptSentence"]>
  export type ScriptSentenceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    audioFiles?: boolean | ScriptSentence$audioFilesArgs<ExtArgs>
    book?: boolean | BookDefaultArgs<ExtArgs>
    character?: boolean | ScriptSentence$characterArgs<ExtArgs>
    segment?: boolean | TextSegmentDefaultArgs<ExtArgs>
    _count?: boolean | ScriptSentenceCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ScriptSentenceIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    character?: boolean | ScriptSentence$characterArgs<ExtArgs>
    segment?: boolean | TextSegmentDefaultArgs<ExtArgs>
  }
  export type ScriptSentenceIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    character?: boolean | ScriptSentence$characterArgs<ExtArgs>
    segment?: boolean | TextSegmentDefaultArgs<ExtArgs>
  }

  export type $ScriptSentencePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ScriptSentence"
    objects: {
      audioFiles: Prisma.$AudioFilePayload<ExtArgs>[]
      book: Prisma.$BookPayload<ExtArgs>
      character: Prisma.$CharacterProfilePayload<ExtArgs> | null
      segment: Prisma.$TextSegmentPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bookId: string
      segmentId: string
      characterId: string | null
      rawSpeaker: string | null
      text: string
      orderInSegment: number
      tone: string | null
      strength: number | null
      pauseAfter: Prisma.Decimal | null
      ttsParameters: Prisma.JsonValue | null
      createdAt: Date
    }, ExtArgs["result"]["scriptSentence"]>
    composites: {}
  }

  type ScriptSentenceGetPayload<S extends boolean | null | undefined | ScriptSentenceDefaultArgs> = $Result.GetResult<Prisma.$ScriptSentencePayload, S>

  type ScriptSentenceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ScriptSentenceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ScriptSentenceCountAggregateInputType | true
    }

  export interface ScriptSentenceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ScriptSentence'], meta: { name: 'ScriptSentence' } }
    /**
     * Find zero or one ScriptSentence that matches the filter.
     * @param {ScriptSentenceFindUniqueArgs} args - Arguments to find a ScriptSentence
     * @example
     * // Get one ScriptSentence
     * const scriptSentence = await prisma.scriptSentence.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ScriptSentenceFindUniqueArgs>(args: SelectSubset<T, ScriptSentenceFindUniqueArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ScriptSentence that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ScriptSentenceFindUniqueOrThrowArgs} args - Arguments to find a ScriptSentence
     * @example
     * // Get one ScriptSentence
     * const scriptSentence = await prisma.scriptSentence.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ScriptSentenceFindUniqueOrThrowArgs>(args: SelectSubset<T, ScriptSentenceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ScriptSentence that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScriptSentenceFindFirstArgs} args - Arguments to find a ScriptSentence
     * @example
     * // Get one ScriptSentence
     * const scriptSentence = await prisma.scriptSentence.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ScriptSentenceFindFirstArgs>(args?: SelectSubset<T, ScriptSentenceFindFirstArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ScriptSentence that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScriptSentenceFindFirstOrThrowArgs} args - Arguments to find a ScriptSentence
     * @example
     * // Get one ScriptSentence
     * const scriptSentence = await prisma.scriptSentence.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ScriptSentenceFindFirstOrThrowArgs>(args?: SelectSubset<T, ScriptSentenceFindFirstOrThrowArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ScriptSentences that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScriptSentenceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ScriptSentences
     * const scriptSentences = await prisma.scriptSentence.findMany()
     * 
     * // Get first 10 ScriptSentences
     * const scriptSentences = await prisma.scriptSentence.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const scriptSentenceWithIdOnly = await prisma.scriptSentence.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ScriptSentenceFindManyArgs>(args?: SelectSubset<T, ScriptSentenceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ScriptSentence.
     * @param {ScriptSentenceCreateArgs} args - Arguments to create a ScriptSentence.
     * @example
     * // Create one ScriptSentence
     * const ScriptSentence = await prisma.scriptSentence.create({
     *   data: {
     *     // ... data to create a ScriptSentence
     *   }
     * })
     * 
     */
    create<T extends ScriptSentenceCreateArgs>(args: SelectSubset<T, ScriptSentenceCreateArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ScriptSentences.
     * @param {ScriptSentenceCreateManyArgs} args - Arguments to create many ScriptSentences.
     * @example
     * // Create many ScriptSentences
     * const scriptSentence = await prisma.scriptSentence.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ScriptSentenceCreateManyArgs>(args?: SelectSubset<T, ScriptSentenceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ScriptSentences and returns the data saved in the database.
     * @param {ScriptSentenceCreateManyAndReturnArgs} args - Arguments to create many ScriptSentences.
     * @example
     * // Create many ScriptSentences
     * const scriptSentence = await prisma.scriptSentence.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ScriptSentences and only return the `id`
     * const scriptSentenceWithIdOnly = await prisma.scriptSentence.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ScriptSentenceCreateManyAndReturnArgs>(args?: SelectSubset<T, ScriptSentenceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ScriptSentence.
     * @param {ScriptSentenceDeleteArgs} args - Arguments to delete one ScriptSentence.
     * @example
     * // Delete one ScriptSentence
     * const ScriptSentence = await prisma.scriptSentence.delete({
     *   where: {
     *     // ... filter to delete one ScriptSentence
     *   }
     * })
     * 
     */
    delete<T extends ScriptSentenceDeleteArgs>(args: SelectSubset<T, ScriptSentenceDeleteArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ScriptSentence.
     * @param {ScriptSentenceUpdateArgs} args - Arguments to update one ScriptSentence.
     * @example
     * // Update one ScriptSentence
     * const scriptSentence = await prisma.scriptSentence.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ScriptSentenceUpdateArgs>(args: SelectSubset<T, ScriptSentenceUpdateArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ScriptSentences.
     * @param {ScriptSentenceDeleteManyArgs} args - Arguments to filter ScriptSentences to delete.
     * @example
     * // Delete a few ScriptSentences
     * const { count } = await prisma.scriptSentence.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ScriptSentenceDeleteManyArgs>(args?: SelectSubset<T, ScriptSentenceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ScriptSentences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScriptSentenceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ScriptSentences
     * const scriptSentence = await prisma.scriptSentence.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ScriptSentenceUpdateManyArgs>(args: SelectSubset<T, ScriptSentenceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ScriptSentences and returns the data updated in the database.
     * @param {ScriptSentenceUpdateManyAndReturnArgs} args - Arguments to update many ScriptSentences.
     * @example
     * // Update many ScriptSentences
     * const scriptSentence = await prisma.scriptSentence.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ScriptSentences and only return the `id`
     * const scriptSentenceWithIdOnly = await prisma.scriptSentence.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ScriptSentenceUpdateManyAndReturnArgs>(args: SelectSubset<T, ScriptSentenceUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ScriptSentence.
     * @param {ScriptSentenceUpsertArgs} args - Arguments to update or create a ScriptSentence.
     * @example
     * // Update or create a ScriptSentence
     * const scriptSentence = await prisma.scriptSentence.upsert({
     *   create: {
     *     // ... data to create a ScriptSentence
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ScriptSentence we want to update
     *   }
     * })
     */
    upsert<T extends ScriptSentenceUpsertArgs>(args: SelectSubset<T, ScriptSentenceUpsertArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ScriptSentences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScriptSentenceCountArgs} args - Arguments to filter ScriptSentences to count.
     * @example
     * // Count the number of ScriptSentences
     * const count = await prisma.scriptSentence.count({
     *   where: {
     *     // ... the filter for the ScriptSentences we want to count
     *   }
     * })
    **/
    count<T extends ScriptSentenceCountArgs>(
      args?: Subset<T, ScriptSentenceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ScriptSentenceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ScriptSentence.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScriptSentenceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ScriptSentenceAggregateArgs>(args: Subset<T, ScriptSentenceAggregateArgs>): Prisma.PrismaPromise<GetScriptSentenceAggregateType<T>>

    /**
     * Group by ScriptSentence.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ScriptSentenceGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ScriptSentenceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ScriptSentenceGroupByArgs['orderBy'] }
        : { orderBy?: ScriptSentenceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ScriptSentenceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetScriptSentenceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ScriptSentence model
   */
  readonly fields: ScriptSentenceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ScriptSentence.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ScriptSentenceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    audioFiles<T extends ScriptSentence$audioFilesArgs<ExtArgs> = {}>(args?: Subset<T, ScriptSentence$audioFilesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    book<T extends BookDefaultArgs<ExtArgs> = {}>(args?: Subset<T, BookDefaultArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    character<T extends ScriptSentence$characterArgs<ExtArgs> = {}>(args?: Subset<T, ScriptSentence$characterArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    segment<T extends TextSegmentDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TextSegmentDefaultArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ScriptSentence model
   */
  interface ScriptSentenceFieldRefs {
    readonly id: FieldRef<"ScriptSentence", 'String'>
    readonly bookId: FieldRef<"ScriptSentence", 'String'>
    readonly segmentId: FieldRef<"ScriptSentence", 'String'>
    readonly characterId: FieldRef<"ScriptSentence", 'String'>
    readonly rawSpeaker: FieldRef<"ScriptSentence", 'String'>
    readonly text: FieldRef<"ScriptSentence", 'String'>
    readonly orderInSegment: FieldRef<"ScriptSentence", 'Int'>
    readonly tone: FieldRef<"ScriptSentence", 'String'>
    readonly strength: FieldRef<"ScriptSentence", 'Int'>
    readonly pauseAfter: FieldRef<"ScriptSentence", 'Decimal'>
    readonly ttsParameters: FieldRef<"ScriptSentence", 'Json'>
    readonly createdAt: FieldRef<"ScriptSentence", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ScriptSentence findUnique
   */
  export type ScriptSentenceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * Filter, which ScriptSentence to fetch.
     */
    where: ScriptSentenceWhereUniqueInput
  }

  /**
   * ScriptSentence findUniqueOrThrow
   */
  export type ScriptSentenceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * Filter, which ScriptSentence to fetch.
     */
    where: ScriptSentenceWhereUniqueInput
  }

  /**
   * ScriptSentence findFirst
   */
  export type ScriptSentenceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * Filter, which ScriptSentence to fetch.
     */
    where?: ScriptSentenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ScriptSentences to fetch.
     */
    orderBy?: ScriptSentenceOrderByWithRelationInput | ScriptSentenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ScriptSentences.
     */
    cursor?: ScriptSentenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ScriptSentences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ScriptSentences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ScriptSentences.
     */
    distinct?: ScriptSentenceScalarFieldEnum | ScriptSentenceScalarFieldEnum[]
  }

  /**
   * ScriptSentence findFirstOrThrow
   */
  export type ScriptSentenceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * Filter, which ScriptSentence to fetch.
     */
    where?: ScriptSentenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ScriptSentences to fetch.
     */
    orderBy?: ScriptSentenceOrderByWithRelationInput | ScriptSentenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ScriptSentences.
     */
    cursor?: ScriptSentenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ScriptSentences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ScriptSentences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ScriptSentences.
     */
    distinct?: ScriptSentenceScalarFieldEnum | ScriptSentenceScalarFieldEnum[]
  }

  /**
   * ScriptSentence findMany
   */
  export type ScriptSentenceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * Filter, which ScriptSentences to fetch.
     */
    where?: ScriptSentenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ScriptSentences to fetch.
     */
    orderBy?: ScriptSentenceOrderByWithRelationInput | ScriptSentenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ScriptSentences.
     */
    cursor?: ScriptSentenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ScriptSentences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ScriptSentences.
     */
    skip?: number
    distinct?: ScriptSentenceScalarFieldEnum | ScriptSentenceScalarFieldEnum[]
  }

  /**
   * ScriptSentence create
   */
  export type ScriptSentenceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * The data needed to create a ScriptSentence.
     */
    data: XOR<ScriptSentenceCreateInput, ScriptSentenceUncheckedCreateInput>
  }

  /**
   * ScriptSentence createMany
   */
  export type ScriptSentenceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ScriptSentences.
     */
    data: ScriptSentenceCreateManyInput | ScriptSentenceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ScriptSentence createManyAndReturn
   */
  export type ScriptSentenceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * The data used to create many ScriptSentences.
     */
    data: ScriptSentenceCreateManyInput | ScriptSentenceCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ScriptSentence update
   */
  export type ScriptSentenceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * The data needed to update a ScriptSentence.
     */
    data: XOR<ScriptSentenceUpdateInput, ScriptSentenceUncheckedUpdateInput>
    /**
     * Choose, which ScriptSentence to update.
     */
    where: ScriptSentenceWhereUniqueInput
  }

  /**
   * ScriptSentence updateMany
   */
  export type ScriptSentenceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ScriptSentences.
     */
    data: XOR<ScriptSentenceUpdateManyMutationInput, ScriptSentenceUncheckedUpdateManyInput>
    /**
     * Filter which ScriptSentences to update
     */
    where?: ScriptSentenceWhereInput
    /**
     * Limit how many ScriptSentences to update.
     */
    limit?: number
  }

  /**
   * ScriptSentence updateManyAndReturn
   */
  export type ScriptSentenceUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * The data used to update ScriptSentences.
     */
    data: XOR<ScriptSentenceUpdateManyMutationInput, ScriptSentenceUncheckedUpdateManyInput>
    /**
     * Filter which ScriptSentences to update
     */
    where?: ScriptSentenceWhereInput
    /**
     * Limit how many ScriptSentences to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ScriptSentence upsert
   */
  export type ScriptSentenceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * The filter to search for the ScriptSentence to update in case it exists.
     */
    where: ScriptSentenceWhereUniqueInput
    /**
     * In case the ScriptSentence found by the `where` argument doesn't exist, create a new ScriptSentence with this data.
     */
    create: XOR<ScriptSentenceCreateInput, ScriptSentenceUncheckedCreateInput>
    /**
     * In case the ScriptSentence was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ScriptSentenceUpdateInput, ScriptSentenceUncheckedUpdateInput>
  }

  /**
   * ScriptSentence delete
   */
  export type ScriptSentenceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    /**
     * Filter which ScriptSentence to delete.
     */
    where: ScriptSentenceWhereUniqueInput
  }

  /**
   * ScriptSentence deleteMany
   */
  export type ScriptSentenceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ScriptSentences to delete
     */
    where?: ScriptSentenceWhereInput
    /**
     * Limit how many ScriptSentences to delete.
     */
    limit?: number
  }

  /**
   * ScriptSentence.audioFiles
   */
  export type ScriptSentence$audioFilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    where?: AudioFileWhereInput
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    cursor?: AudioFileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AudioFileScalarFieldEnum | AudioFileScalarFieldEnum[]
  }

  /**
   * ScriptSentence.character
   */
  export type ScriptSentence$characterArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterProfile
     */
    select?: CharacterProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterProfile
     */
    omit?: CharacterProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterProfileInclude<ExtArgs> | null
    where?: CharacterProfileWhereInput
  }

  /**
   * ScriptSentence without action
   */
  export type ScriptSentenceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
  }


  /**
   * Model AudioFile
   */

  export type AggregateAudioFile = {
    _count: AudioFileCountAggregateOutputType | null
    _avg: AudioFileAvgAggregateOutputType | null
    _sum: AudioFileSumAggregateOutputType | null
    _min: AudioFileMinAggregateOutputType | null
    _max: AudioFileMaxAggregateOutputType | null
  }

  export type AudioFileAvgAggregateOutputType = {
    duration: Decimal | null
    fileSize: number | null
    retryCount: number | null
  }

  export type AudioFileSumAggregateOutputType = {
    duration: Decimal | null
    fileSize: bigint | null
    retryCount: number | null
  }

  export type AudioFileMinAggregateOutputType = {
    id: string | null
    bookId: string | null
    sentenceId: string | null
    segmentId: string | null
    filePath: string | null
    fileName: string | null
    duration: Decimal | null
    fileSize: bigint | null
    format: string | null
    status: string | null
    errorMessage: string | null
    retryCount: number | null
    provider: string | null
    voiceProfileId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AudioFileMaxAggregateOutputType = {
    id: string | null
    bookId: string | null
    sentenceId: string | null
    segmentId: string | null
    filePath: string | null
    fileName: string | null
    duration: Decimal | null
    fileSize: bigint | null
    format: string | null
    status: string | null
    errorMessage: string | null
    retryCount: number | null
    provider: string | null
    voiceProfileId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AudioFileCountAggregateOutputType = {
    id: number
    bookId: number
    sentenceId: number
    segmentId: number
    filePath: number
    fileName: number
    duration: number
    fileSize: number
    format: number
    status: number
    errorMessage: number
    retryCount: number
    provider: number
    voiceProfileId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AudioFileAvgAggregateInputType = {
    duration?: true
    fileSize?: true
    retryCount?: true
  }

  export type AudioFileSumAggregateInputType = {
    duration?: true
    fileSize?: true
    retryCount?: true
  }

  export type AudioFileMinAggregateInputType = {
    id?: true
    bookId?: true
    sentenceId?: true
    segmentId?: true
    filePath?: true
    fileName?: true
    duration?: true
    fileSize?: true
    format?: true
    status?: true
    errorMessage?: true
    retryCount?: true
    provider?: true
    voiceProfileId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AudioFileMaxAggregateInputType = {
    id?: true
    bookId?: true
    sentenceId?: true
    segmentId?: true
    filePath?: true
    fileName?: true
    duration?: true
    fileSize?: true
    format?: true
    status?: true
    errorMessage?: true
    retryCount?: true
    provider?: true
    voiceProfileId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AudioFileCountAggregateInputType = {
    id?: true
    bookId?: true
    sentenceId?: true
    segmentId?: true
    filePath?: true
    fileName?: true
    duration?: true
    fileSize?: true
    format?: true
    status?: true
    errorMessage?: true
    retryCount?: true
    provider?: true
    voiceProfileId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AudioFileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AudioFile to aggregate.
     */
    where?: AudioFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AudioFiles to fetch.
     */
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AudioFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AudioFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AudioFiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AudioFiles
    **/
    _count?: true | AudioFileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AudioFileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AudioFileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AudioFileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AudioFileMaxAggregateInputType
  }

  export type GetAudioFileAggregateType<T extends AudioFileAggregateArgs> = {
        [P in keyof T & keyof AggregateAudioFile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAudioFile[P]>
      : GetScalarType<T[P], AggregateAudioFile[P]>
  }




  export type AudioFileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AudioFileWhereInput
    orderBy?: AudioFileOrderByWithAggregationInput | AudioFileOrderByWithAggregationInput[]
    by: AudioFileScalarFieldEnum[] | AudioFileScalarFieldEnum
    having?: AudioFileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AudioFileCountAggregateInputType | true
    _avg?: AudioFileAvgAggregateInputType
    _sum?: AudioFileSumAggregateInputType
    _min?: AudioFileMinAggregateInputType
    _max?: AudioFileMaxAggregateInputType
  }

  export type AudioFileGroupByOutputType = {
    id: string
    bookId: string
    sentenceId: string | null
    segmentId: string | null
    filePath: string
    fileName: string | null
    duration: Decimal | null
    fileSize: bigint | null
    format: string | null
    status: string
    errorMessage: string | null
    retryCount: number
    provider: string | null
    voiceProfileId: string | null
    createdAt: Date
    updatedAt: Date
    _count: AudioFileCountAggregateOutputType | null
    _avg: AudioFileAvgAggregateOutputType | null
    _sum: AudioFileSumAggregateOutputType | null
    _min: AudioFileMinAggregateOutputType | null
    _max: AudioFileMaxAggregateOutputType | null
  }

  type GetAudioFileGroupByPayload<T extends AudioFileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AudioFileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AudioFileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AudioFileGroupByOutputType[P]>
            : GetScalarType<T[P], AudioFileGroupByOutputType[P]>
        }
      >
    >


  export type AudioFileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    sentenceId?: boolean
    segmentId?: boolean
    filePath?: boolean
    fileName?: boolean
    duration?: boolean
    fileSize?: boolean
    format?: boolean
    status?: boolean
    errorMessage?: boolean
    retryCount?: boolean
    provider?: boolean
    voiceProfileId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    segment?: boolean | AudioFile$segmentArgs<ExtArgs>
    scriptSentence?: boolean | AudioFile$scriptSentenceArgs<ExtArgs>
    voiceProfile?: boolean | AudioFile$voiceProfileArgs<ExtArgs>
  }, ExtArgs["result"]["audioFile"]>

  export type AudioFileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    sentenceId?: boolean
    segmentId?: boolean
    filePath?: boolean
    fileName?: boolean
    duration?: boolean
    fileSize?: boolean
    format?: boolean
    status?: boolean
    errorMessage?: boolean
    retryCount?: boolean
    provider?: boolean
    voiceProfileId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    segment?: boolean | AudioFile$segmentArgs<ExtArgs>
    scriptSentence?: boolean | AudioFile$scriptSentenceArgs<ExtArgs>
    voiceProfile?: boolean | AudioFile$voiceProfileArgs<ExtArgs>
  }, ExtArgs["result"]["audioFile"]>

  export type AudioFileSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    sentenceId?: boolean
    segmentId?: boolean
    filePath?: boolean
    fileName?: boolean
    duration?: boolean
    fileSize?: boolean
    format?: boolean
    status?: boolean
    errorMessage?: boolean
    retryCount?: boolean
    provider?: boolean
    voiceProfileId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    segment?: boolean | AudioFile$segmentArgs<ExtArgs>
    scriptSentence?: boolean | AudioFile$scriptSentenceArgs<ExtArgs>
    voiceProfile?: boolean | AudioFile$voiceProfileArgs<ExtArgs>
  }, ExtArgs["result"]["audioFile"]>

  export type AudioFileSelectScalar = {
    id?: boolean
    bookId?: boolean
    sentenceId?: boolean
    segmentId?: boolean
    filePath?: boolean
    fileName?: boolean
    duration?: boolean
    fileSize?: boolean
    format?: boolean
    status?: boolean
    errorMessage?: boolean
    retryCount?: boolean
    provider?: boolean
    voiceProfileId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AudioFileOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bookId" | "sentenceId" | "segmentId" | "filePath" | "fileName" | "duration" | "fileSize" | "format" | "status" | "errorMessage" | "retryCount" | "provider" | "voiceProfileId" | "createdAt" | "updatedAt", ExtArgs["result"]["audioFile"]>
  export type AudioFileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    segment?: boolean | AudioFile$segmentArgs<ExtArgs>
    scriptSentence?: boolean | AudioFile$scriptSentenceArgs<ExtArgs>
    voiceProfile?: boolean | AudioFile$voiceProfileArgs<ExtArgs>
  }
  export type AudioFileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    segment?: boolean | AudioFile$segmentArgs<ExtArgs>
    scriptSentence?: boolean | AudioFile$scriptSentenceArgs<ExtArgs>
    voiceProfile?: boolean | AudioFile$voiceProfileArgs<ExtArgs>
  }
  export type AudioFileIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    segment?: boolean | AudioFile$segmentArgs<ExtArgs>
    scriptSentence?: boolean | AudioFile$scriptSentenceArgs<ExtArgs>
    voiceProfile?: boolean | AudioFile$voiceProfileArgs<ExtArgs>
  }

  export type $AudioFilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AudioFile"
    objects: {
      book: Prisma.$BookPayload<ExtArgs>
      segment: Prisma.$TextSegmentPayload<ExtArgs> | null
      scriptSentence: Prisma.$ScriptSentencePayload<ExtArgs> | null
      voiceProfile: Prisma.$TTSVoiceProfilePayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bookId: string
      sentenceId: string | null
      segmentId: string | null
      filePath: string
      fileName: string | null
      duration: Prisma.Decimal | null
      fileSize: bigint | null
      format: string | null
      status: string
      errorMessage: string | null
      retryCount: number
      provider: string | null
      voiceProfileId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["audioFile"]>
    composites: {}
  }

  type AudioFileGetPayload<S extends boolean | null | undefined | AudioFileDefaultArgs> = $Result.GetResult<Prisma.$AudioFilePayload, S>

  type AudioFileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<AudioFileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AudioFileCountAggregateInputType | true
    }

  export interface AudioFileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AudioFile'], meta: { name: 'AudioFile' } }
    /**
     * Find zero or one AudioFile that matches the filter.
     * @param {AudioFileFindUniqueArgs} args - Arguments to find a AudioFile
     * @example
     * // Get one AudioFile
     * const audioFile = await prisma.audioFile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AudioFileFindUniqueArgs>(args: SelectSubset<T, AudioFileFindUniqueArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one AudioFile that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {AudioFileFindUniqueOrThrowArgs} args - Arguments to find a AudioFile
     * @example
     * // Get one AudioFile
     * const audioFile = await prisma.audioFile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AudioFileFindUniqueOrThrowArgs>(args: SelectSubset<T, AudioFileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AudioFile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AudioFileFindFirstArgs} args - Arguments to find a AudioFile
     * @example
     * // Get one AudioFile
     * const audioFile = await prisma.audioFile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AudioFileFindFirstArgs>(args?: SelectSubset<T, AudioFileFindFirstArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first AudioFile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AudioFileFindFirstOrThrowArgs} args - Arguments to find a AudioFile
     * @example
     * // Get one AudioFile
     * const audioFile = await prisma.audioFile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AudioFileFindFirstOrThrowArgs>(args?: SelectSubset<T, AudioFileFindFirstOrThrowArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more AudioFiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AudioFileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AudioFiles
     * const audioFiles = await prisma.audioFile.findMany()
     * 
     * // Get first 10 AudioFiles
     * const audioFiles = await prisma.audioFile.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const audioFileWithIdOnly = await prisma.audioFile.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AudioFileFindManyArgs>(args?: SelectSubset<T, AudioFileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a AudioFile.
     * @param {AudioFileCreateArgs} args - Arguments to create a AudioFile.
     * @example
     * // Create one AudioFile
     * const AudioFile = await prisma.audioFile.create({
     *   data: {
     *     // ... data to create a AudioFile
     *   }
     * })
     * 
     */
    create<T extends AudioFileCreateArgs>(args: SelectSubset<T, AudioFileCreateArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many AudioFiles.
     * @param {AudioFileCreateManyArgs} args - Arguments to create many AudioFiles.
     * @example
     * // Create many AudioFiles
     * const audioFile = await prisma.audioFile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AudioFileCreateManyArgs>(args?: SelectSubset<T, AudioFileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AudioFiles and returns the data saved in the database.
     * @param {AudioFileCreateManyAndReturnArgs} args - Arguments to create many AudioFiles.
     * @example
     * // Create many AudioFiles
     * const audioFile = await prisma.audioFile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AudioFiles and only return the `id`
     * const audioFileWithIdOnly = await prisma.audioFile.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AudioFileCreateManyAndReturnArgs>(args?: SelectSubset<T, AudioFileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a AudioFile.
     * @param {AudioFileDeleteArgs} args - Arguments to delete one AudioFile.
     * @example
     * // Delete one AudioFile
     * const AudioFile = await prisma.audioFile.delete({
     *   where: {
     *     // ... filter to delete one AudioFile
     *   }
     * })
     * 
     */
    delete<T extends AudioFileDeleteArgs>(args: SelectSubset<T, AudioFileDeleteArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one AudioFile.
     * @param {AudioFileUpdateArgs} args - Arguments to update one AudioFile.
     * @example
     * // Update one AudioFile
     * const audioFile = await prisma.audioFile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AudioFileUpdateArgs>(args: SelectSubset<T, AudioFileUpdateArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more AudioFiles.
     * @param {AudioFileDeleteManyArgs} args - Arguments to filter AudioFiles to delete.
     * @example
     * // Delete a few AudioFiles
     * const { count } = await prisma.audioFile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AudioFileDeleteManyArgs>(args?: SelectSubset<T, AudioFileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AudioFiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AudioFileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AudioFiles
     * const audioFile = await prisma.audioFile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AudioFileUpdateManyArgs>(args: SelectSubset<T, AudioFileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AudioFiles and returns the data updated in the database.
     * @param {AudioFileUpdateManyAndReturnArgs} args - Arguments to update many AudioFiles.
     * @example
     * // Update many AudioFiles
     * const audioFile = await prisma.audioFile.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more AudioFiles and only return the `id`
     * const audioFileWithIdOnly = await prisma.audioFile.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends AudioFileUpdateManyAndReturnArgs>(args: SelectSubset<T, AudioFileUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one AudioFile.
     * @param {AudioFileUpsertArgs} args - Arguments to update or create a AudioFile.
     * @example
     * // Update or create a AudioFile
     * const audioFile = await prisma.audioFile.upsert({
     *   create: {
     *     // ... data to create a AudioFile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AudioFile we want to update
     *   }
     * })
     */
    upsert<T extends AudioFileUpsertArgs>(args: SelectSubset<T, AudioFileUpsertArgs<ExtArgs>>): Prisma__AudioFileClient<$Result.GetResult<Prisma.$AudioFilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of AudioFiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AudioFileCountArgs} args - Arguments to filter AudioFiles to count.
     * @example
     * // Count the number of AudioFiles
     * const count = await prisma.audioFile.count({
     *   where: {
     *     // ... the filter for the AudioFiles we want to count
     *   }
     * })
    **/
    count<T extends AudioFileCountArgs>(
      args?: Subset<T, AudioFileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AudioFileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AudioFile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AudioFileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AudioFileAggregateArgs>(args: Subset<T, AudioFileAggregateArgs>): Prisma.PrismaPromise<GetAudioFileAggregateType<T>>

    /**
     * Group by AudioFile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AudioFileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AudioFileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AudioFileGroupByArgs['orderBy'] }
        : { orderBy?: AudioFileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AudioFileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAudioFileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AudioFile model
   */
  readonly fields: AudioFileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AudioFile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AudioFileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    book<T extends BookDefaultArgs<ExtArgs> = {}>(args?: Subset<T, BookDefaultArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    segment<T extends AudioFile$segmentArgs<ExtArgs> = {}>(args?: Subset<T, AudioFile$segmentArgs<ExtArgs>>): Prisma__TextSegmentClient<$Result.GetResult<Prisma.$TextSegmentPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    scriptSentence<T extends AudioFile$scriptSentenceArgs<ExtArgs> = {}>(args?: Subset<T, AudioFile$scriptSentenceArgs<ExtArgs>>): Prisma__ScriptSentenceClient<$Result.GetResult<Prisma.$ScriptSentencePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    voiceProfile<T extends AudioFile$voiceProfileArgs<ExtArgs> = {}>(args?: Subset<T, AudioFile$voiceProfileArgs<ExtArgs>>): Prisma__TTSVoiceProfileClient<$Result.GetResult<Prisma.$TTSVoiceProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AudioFile model
   */
  interface AudioFileFieldRefs {
    readonly id: FieldRef<"AudioFile", 'String'>
    readonly bookId: FieldRef<"AudioFile", 'String'>
    readonly sentenceId: FieldRef<"AudioFile", 'String'>
    readonly segmentId: FieldRef<"AudioFile", 'String'>
    readonly filePath: FieldRef<"AudioFile", 'String'>
    readonly fileName: FieldRef<"AudioFile", 'String'>
    readonly duration: FieldRef<"AudioFile", 'Decimal'>
    readonly fileSize: FieldRef<"AudioFile", 'BigInt'>
    readonly format: FieldRef<"AudioFile", 'String'>
    readonly status: FieldRef<"AudioFile", 'String'>
    readonly errorMessage: FieldRef<"AudioFile", 'String'>
    readonly retryCount: FieldRef<"AudioFile", 'Int'>
    readonly provider: FieldRef<"AudioFile", 'String'>
    readonly voiceProfileId: FieldRef<"AudioFile", 'String'>
    readonly createdAt: FieldRef<"AudioFile", 'DateTime'>
    readonly updatedAt: FieldRef<"AudioFile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * AudioFile findUnique
   */
  export type AudioFileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * Filter, which AudioFile to fetch.
     */
    where: AudioFileWhereUniqueInput
  }

  /**
   * AudioFile findUniqueOrThrow
   */
  export type AudioFileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * Filter, which AudioFile to fetch.
     */
    where: AudioFileWhereUniqueInput
  }

  /**
   * AudioFile findFirst
   */
  export type AudioFileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * Filter, which AudioFile to fetch.
     */
    where?: AudioFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AudioFiles to fetch.
     */
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AudioFiles.
     */
    cursor?: AudioFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AudioFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AudioFiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AudioFiles.
     */
    distinct?: AudioFileScalarFieldEnum | AudioFileScalarFieldEnum[]
  }

  /**
   * AudioFile findFirstOrThrow
   */
  export type AudioFileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * Filter, which AudioFile to fetch.
     */
    where?: AudioFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AudioFiles to fetch.
     */
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AudioFiles.
     */
    cursor?: AudioFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AudioFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AudioFiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AudioFiles.
     */
    distinct?: AudioFileScalarFieldEnum | AudioFileScalarFieldEnum[]
  }

  /**
   * AudioFile findMany
   */
  export type AudioFileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * Filter, which AudioFiles to fetch.
     */
    where?: AudioFileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AudioFiles to fetch.
     */
    orderBy?: AudioFileOrderByWithRelationInput | AudioFileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AudioFiles.
     */
    cursor?: AudioFileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AudioFiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AudioFiles.
     */
    skip?: number
    distinct?: AudioFileScalarFieldEnum | AudioFileScalarFieldEnum[]
  }

  /**
   * AudioFile create
   */
  export type AudioFileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * The data needed to create a AudioFile.
     */
    data: XOR<AudioFileCreateInput, AudioFileUncheckedCreateInput>
  }

  /**
   * AudioFile createMany
   */
  export type AudioFileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AudioFiles.
     */
    data: AudioFileCreateManyInput | AudioFileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AudioFile createManyAndReturn
   */
  export type AudioFileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * The data used to create many AudioFiles.
     */
    data: AudioFileCreateManyInput | AudioFileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AudioFile update
   */
  export type AudioFileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * The data needed to update a AudioFile.
     */
    data: XOR<AudioFileUpdateInput, AudioFileUncheckedUpdateInput>
    /**
     * Choose, which AudioFile to update.
     */
    where: AudioFileWhereUniqueInput
  }

  /**
   * AudioFile updateMany
   */
  export type AudioFileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AudioFiles.
     */
    data: XOR<AudioFileUpdateManyMutationInput, AudioFileUncheckedUpdateManyInput>
    /**
     * Filter which AudioFiles to update
     */
    where?: AudioFileWhereInput
    /**
     * Limit how many AudioFiles to update.
     */
    limit?: number
  }

  /**
   * AudioFile updateManyAndReturn
   */
  export type AudioFileUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * The data used to update AudioFiles.
     */
    data: XOR<AudioFileUpdateManyMutationInput, AudioFileUncheckedUpdateManyInput>
    /**
     * Filter which AudioFiles to update
     */
    where?: AudioFileWhereInput
    /**
     * Limit how many AudioFiles to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * AudioFile upsert
   */
  export type AudioFileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * The filter to search for the AudioFile to update in case it exists.
     */
    where: AudioFileWhereUniqueInput
    /**
     * In case the AudioFile found by the `where` argument doesn't exist, create a new AudioFile with this data.
     */
    create: XOR<AudioFileCreateInput, AudioFileUncheckedCreateInput>
    /**
     * In case the AudioFile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AudioFileUpdateInput, AudioFileUncheckedUpdateInput>
  }

  /**
   * AudioFile delete
   */
  export type AudioFileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
    /**
     * Filter which AudioFile to delete.
     */
    where: AudioFileWhereUniqueInput
  }

  /**
   * AudioFile deleteMany
   */
  export type AudioFileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AudioFiles to delete
     */
    where?: AudioFileWhereInput
    /**
     * Limit how many AudioFiles to delete.
     */
    limit?: number
  }

  /**
   * AudioFile.segment
   */
  export type AudioFile$segmentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TextSegment
     */
    select?: TextSegmentSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TextSegment
     */
    omit?: TextSegmentOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TextSegmentInclude<ExtArgs> | null
    where?: TextSegmentWhereInput
  }

  /**
   * AudioFile.scriptSentence
   */
  export type AudioFile$scriptSentenceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ScriptSentence
     */
    select?: ScriptSentenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ScriptSentence
     */
    omit?: ScriptSentenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ScriptSentenceInclude<ExtArgs> | null
    where?: ScriptSentenceWhereInput
  }

  /**
   * AudioFile.voiceProfile
   */
  export type AudioFile$voiceProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TTSVoiceProfile
     */
    select?: TTSVoiceProfileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the TTSVoiceProfile
     */
    omit?: TTSVoiceProfileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TTSVoiceProfileInclude<ExtArgs> | null
    where?: TTSVoiceProfileWhereInput
  }

  /**
   * AudioFile without action
   */
  export type AudioFileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AudioFile
     */
    select?: AudioFileSelect<ExtArgs> | null
    /**
     * Omit specific fields from the AudioFile
     */
    omit?: AudioFileOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AudioFileInclude<ExtArgs> | null
  }


  /**
   * Model CharacterMergeAudit
   */

  export type AggregateCharacterMergeAudit = {
    _count: CharacterMergeAuditCountAggregateOutputType | null
    _min: CharacterMergeAuditMinAggregateOutputType | null
    _max: CharacterMergeAuditMaxAggregateOutputType | null
  }

  export type CharacterMergeAuditMinAggregateOutputType = {
    id: string | null
    bookId: string | null
    sourceCharacterId: string | null
    targetCharacterId: string | null
    mergeReason: string | null
    mergedBy: string | null
    createdAt: Date | null
  }

  export type CharacterMergeAuditMaxAggregateOutputType = {
    id: string | null
    bookId: string | null
    sourceCharacterId: string | null
    targetCharacterId: string | null
    mergeReason: string | null
    mergedBy: string | null
    createdAt: Date | null
  }

  export type CharacterMergeAuditCountAggregateOutputType = {
    id: number
    bookId: number
    sourceCharacterId: number
    targetCharacterId: number
    mergeReason: number
    mergedBy: number
    createdAt: number
    _all: number
  }


  export type CharacterMergeAuditMinAggregateInputType = {
    id?: true
    bookId?: true
    sourceCharacterId?: true
    targetCharacterId?: true
    mergeReason?: true
    mergedBy?: true
    createdAt?: true
  }

  export type CharacterMergeAuditMaxAggregateInputType = {
    id?: true
    bookId?: true
    sourceCharacterId?: true
    targetCharacterId?: true
    mergeReason?: true
    mergedBy?: true
    createdAt?: true
  }

  export type CharacterMergeAuditCountAggregateInputType = {
    id?: true
    bookId?: true
    sourceCharacterId?: true
    targetCharacterId?: true
    mergeReason?: true
    mergedBy?: true
    createdAt?: true
    _all?: true
  }

  export type CharacterMergeAuditAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterMergeAudit to aggregate.
     */
    where?: CharacterMergeAuditWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterMergeAudits to fetch.
     */
    orderBy?: CharacterMergeAuditOrderByWithRelationInput | CharacterMergeAuditOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CharacterMergeAuditWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterMergeAudits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterMergeAudits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CharacterMergeAudits
    **/
    _count?: true | CharacterMergeAuditCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CharacterMergeAuditMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CharacterMergeAuditMaxAggregateInputType
  }

  export type GetCharacterMergeAuditAggregateType<T extends CharacterMergeAuditAggregateArgs> = {
        [P in keyof T & keyof AggregateCharacterMergeAudit]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCharacterMergeAudit[P]>
      : GetScalarType<T[P], AggregateCharacterMergeAudit[P]>
  }




  export type CharacterMergeAuditGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CharacterMergeAuditWhereInput
    orderBy?: CharacterMergeAuditOrderByWithAggregationInput | CharacterMergeAuditOrderByWithAggregationInput[]
    by: CharacterMergeAuditScalarFieldEnum[] | CharacterMergeAuditScalarFieldEnum
    having?: CharacterMergeAuditScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CharacterMergeAuditCountAggregateInputType | true
    _min?: CharacterMergeAuditMinAggregateInputType
    _max?: CharacterMergeAuditMaxAggregateInputType
  }

  export type CharacterMergeAuditGroupByOutputType = {
    id: string
    bookId: string
    sourceCharacterId: string
    targetCharacterId: string
    mergeReason: string | null
    mergedBy: string | null
    createdAt: Date
    _count: CharacterMergeAuditCountAggregateOutputType | null
    _min: CharacterMergeAuditMinAggregateOutputType | null
    _max: CharacterMergeAuditMaxAggregateOutputType | null
  }

  type GetCharacterMergeAuditGroupByPayload<T extends CharacterMergeAuditGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CharacterMergeAuditGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CharacterMergeAuditGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CharacterMergeAuditGroupByOutputType[P]>
            : GetScalarType<T[P], CharacterMergeAuditGroupByOutputType[P]>
        }
      >
    >


  export type CharacterMergeAuditSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    sourceCharacterId?: boolean
    targetCharacterId?: boolean
    mergeReason?: boolean
    mergedBy?: boolean
    createdAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    sourceCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    targetCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterMergeAudit"]>

  export type CharacterMergeAuditSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    sourceCharacterId?: boolean
    targetCharacterId?: boolean
    mergeReason?: boolean
    mergedBy?: boolean
    createdAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    sourceCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    targetCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterMergeAudit"]>

  export type CharacterMergeAuditSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    sourceCharacterId?: boolean
    targetCharacterId?: boolean
    mergeReason?: boolean
    mergedBy?: boolean
    createdAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
    sourceCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    targetCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["characterMergeAudit"]>

  export type CharacterMergeAuditSelectScalar = {
    id?: boolean
    bookId?: boolean
    sourceCharacterId?: boolean
    targetCharacterId?: boolean
    mergeReason?: boolean
    mergedBy?: boolean
    createdAt?: boolean
  }

  export type CharacterMergeAuditOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bookId" | "sourceCharacterId" | "targetCharacterId" | "mergeReason" | "mergedBy" | "createdAt", ExtArgs["result"]["characterMergeAudit"]>
  export type CharacterMergeAuditInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    sourceCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    targetCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }
  export type CharacterMergeAuditIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    sourceCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    targetCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }
  export type CharacterMergeAuditIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
    sourceCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
    targetCharacter?: boolean | CharacterProfileDefaultArgs<ExtArgs>
  }

  export type $CharacterMergeAuditPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CharacterMergeAudit"
    objects: {
      book: Prisma.$BookPayload<ExtArgs>
      sourceCharacter: Prisma.$CharacterProfilePayload<ExtArgs>
      targetCharacter: Prisma.$CharacterProfilePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bookId: string
      sourceCharacterId: string
      targetCharacterId: string
      mergeReason: string | null
      mergedBy: string | null
      createdAt: Date
    }, ExtArgs["result"]["characterMergeAudit"]>
    composites: {}
  }

  type CharacterMergeAuditGetPayload<S extends boolean | null | undefined | CharacterMergeAuditDefaultArgs> = $Result.GetResult<Prisma.$CharacterMergeAuditPayload, S>

  type CharacterMergeAuditCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CharacterMergeAuditFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CharacterMergeAuditCountAggregateInputType | true
    }

  export interface CharacterMergeAuditDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CharacterMergeAudit'], meta: { name: 'CharacterMergeAudit' } }
    /**
     * Find zero or one CharacterMergeAudit that matches the filter.
     * @param {CharacterMergeAuditFindUniqueArgs} args - Arguments to find a CharacterMergeAudit
     * @example
     * // Get one CharacterMergeAudit
     * const characterMergeAudit = await prisma.characterMergeAudit.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CharacterMergeAuditFindUniqueArgs>(args: SelectSubset<T, CharacterMergeAuditFindUniqueArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one CharacterMergeAudit that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CharacterMergeAuditFindUniqueOrThrowArgs} args - Arguments to find a CharacterMergeAudit
     * @example
     * // Get one CharacterMergeAudit
     * const characterMergeAudit = await prisma.characterMergeAudit.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CharacterMergeAuditFindUniqueOrThrowArgs>(args: SelectSubset<T, CharacterMergeAuditFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterMergeAudit that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterMergeAuditFindFirstArgs} args - Arguments to find a CharacterMergeAudit
     * @example
     * // Get one CharacterMergeAudit
     * const characterMergeAudit = await prisma.characterMergeAudit.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CharacterMergeAuditFindFirstArgs>(args?: SelectSubset<T, CharacterMergeAuditFindFirstArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first CharacterMergeAudit that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterMergeAuditFindFirstOrThrowArgs} args - Arguments to find a CharacterMergeAudit
     * @example
     * // Get one CharacterMergeAudit
     * const characterMergeAudit = await prisma.characterMergeAudit.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CharacterMergeAuditFindFirstOrThrowArgs>(args?: SelectSubset<T, CharacterMergeAuditFindFirstOrThrowArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more CharacterMergeAudits that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterMergeAuditFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CharacterMergeAudits
     * const characterMergeAudits = await prisma.characterMergeAudit.findMany()
     * 
     * // Get first 10 CharacterMergeAudits
     * const characterMergeAudits = await prisma.characterMergeAudit.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const characterMergeAuditWithIdOnly = await prisma.characterMergeAudit.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CharacterMergeAuditFindManyArgs>(args?: SelectSubset<T, CharacterMergeAuditFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a CharacterMergeAudit.
     * @param {CharacterMergeAuditCreateArgs} args - Arguments to create a CharacterMergeAudit.
     * @example
     * // Create one CharacterMergeAudit
     * const CharacterMergeAudit = await prisma.characterMergeAudit.create({
     *   data: {
     *     // ... data to create a CharacterMergeAudit
     *   }
     * })
     * 
     */
    create<T extends CharacterMergeAuditCreateArgs>(args: SelectSubset<T, CharacterMergeAuditCreateArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many CharacterMergeAudits.
     * @param {CharacterMergeAuditCreateManyArgs} args - Arguments to create many CharacterMergeAudits.
     * @example
     * // Create many CharacterMergeAudits
     * const characterMergeAudit = await prisma.characterMergeAudit.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CharacterMergeAuditCreateManyArgs>(args?: SelectSubset<T, CharacterMergeAuditCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CharacterMergeAudits and returns the data saved in the database.
     * @param {CharacterMergeAuditCreateManyAndReturnArgs} args - Arguments to create many CharacterMergeAudits.
     * @example
     * // Create many CharacterMergeAudits
     * const characterMergeAudit = await prisma.characterMergeAudit.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CharacterMergeAudits and only return the `id`
     * const characterMergeAuditWithIdOnly = await prisma.characterMergeAudit.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CharacterMergeAuditCreateManyAndReturnArgs>(args?: SelectSubset<T, CharacterMergeAuditCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a CharacterMergeAudit.
     * @param {CharacterMergeAuditDeleteArgs} args - Arguments to delete one CharacterMergeAudit.
     * @example
     * // Delete one CharacterMergeAudit
     * const CharacterMergeAudit = await prisma.characterMergeAudit.delete({
     *   where: {
     *     // ... filter to delete one CharacterMergeAudit
     *   }
     * })
     * 
     */
    delete<T extends CharacterMergeAuditDeleteArgs>(args: SelectSubset<T, CharacterMergeAuditDeleteArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one CharacterMergeAudit.
     * @param {CharacterMergeAuditUpdateArgs} args - Arguments to update one CharacterMergeAudit.
     * @example
     * // Update one CharacterMergeAudit
     * const characterMergeAudit = await prisma.characterMergeAudit.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CharacterMergeAuditUpdateArgs>(args: SelectSubset<T, CharacterMergeAuditUpdateArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more CharacterMergeAudits.
     * @param {CharacterMergeAuditDeleteManyArgs} args - Arguments to filter CharacterMergeAudits to delete.
     * @example
     * // Delete a few CharacterMergeAudits
     * const { count } = await prisma.characterMergeAudit.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CharacterMergeAuditDeleteManyArgs>(args?: SelectSubset<T, CharacterMergeAuditDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterMergeAudits.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterMergeAuditUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CharacterMergeAudits
     * const characterMergeAudit = await prisma.characterMergeAudit.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CharacterMergeAuditUpdateManyArgs>(args: SelectSubset<T, CharacterMergeAuditUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CharacterMergeAudits and returns the data updated in the database.
     * @param {CharacterMergeAuditUpdateManyAndReturnArgs} args - Arguments to update many CharacterMergeAudits.
     * @example
     * // Update many CharacterMergeAudits
     * const characterMergeAudit = await prisma.characterMergeAudit.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more CharacterMergeAudits and only return the `id`
     * const characterMergeAuditWithIdOnly = await prisma.characterMergeAudit.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CharacterMergeAuditUpdateManyAndReturnArgs>(args: SelectSubset<T, CharacterMergeAuditUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one CharacterMergeAudit.
     * @param {CharacterMergeAuditUpsertArgs} args - Arguments to update or create a CharacterMergeAudit.
     * @example
     * // Update or create a CharacterMergeAudit
     * const characterMergeAudit = await prisma.characterMergeAudit.upsert({
     *   create: {
     *     // ... data to create a CharacterMergeAudit
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CharacterMergeAudit we want to update
     *   }
     * })
     */
    upsert<T extends CharacterMergeAuditUpsertArgs>(args: SelectSubset<T, CharacterMergeAuditUpsertArgs<ExtArgs>>): Prisma__CharacterMergeAuditClient<$Result.GetResult<Prisma.$CharacterMergeAuditPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of CharacterMergeAudits.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterMergeAuditCountArgs} args - Arguments to filter CharacterMergeAudits to count.
     * @example
     * // Count the number of CharacterMergeAudits
     * const count = await prisma.characterMergeAudit.count({
     *   where: {
     *     // ... the filter for the CharacterMergeAudits we want to count
     *   }
     * })
    **/
    count<T extends CharacterMergeAuditCountArgs>(
      args?: Subset<T, CharacterMergeAuditCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CharacterMergeAuditCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CharacterMergeAudit.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterMergeAuditAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CharacterMergeAuditAggregateArgs>(args: Subset<T, CharacterMergeAuditAggregateArgs>): Prisma.PrismaPromise<GetCharacterMergeAuditAggregateType<T>>

    /**
     * Group by CharacterMergeAudit.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CharacterMergeAuditGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CharacterMergeAuditGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CharacterMergeAuditGroupByArgs['orderBy'] }
        : { orderBy?: CharacterMergeAuditGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CharacterMergeAuditGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCharacterMergeAuditGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CharacterMergeAudit model
   */
  readonly fields: CharacterMergeAuditFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CharacterMergeAudit.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CharacterMergeAuditClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    book<T extends BookDefaultArgs<ExtArgs> = {}>(args?: Subset<T, BookDefaultArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    sourceCharacter<T extends CharacterProfileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfileDefaultArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    targetCharacter<T extends CharacterProfileDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CharacterProfileDefaultArgs<ExtArgs>>): Prisma__CharacterProfileClient<$Result.GetResult<Prisma.$CharacterProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CharacterMergeAudit model
   */
  interface CharacterMergeAuditFieldRefs {
    readonly id: FieldRef<"CharacterMergeAudit", 'String'>
    readonly bookId: FieldRef<"CharacterMergeAudit", 'String'>
    readonly sourceCharacterId: FieldRef<"CharacterMergeAudit", 'String'>
    readonly targetCharacterId: FieldRef<"CharacterMergeAudit", 'String'>
    readonly mergeReason: FieldRef<"CharacterMergeAudit", 'String'>
    readonly mergedBy: FieldRef<"CharacterMergeAudit", 'String'>
    readonly createdAt: FieldRef<"CharacterMergeAudit", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * CharacterMergeAudit findUnique
   */
  export type CharacterMergeAuditFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * Filter, which CharacterMergeAudit to fetch.
     */
    where: CharacterMergeAuditWhereUniqueInput
  }

  /**
   * CharacterMergeAudit findUniqueOrThrow
   */
  export type CharacterMergeAuditFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * Filter, which CharacterMergeAudit to fetch.
     */
    where: CharacterMergeAuditWhereUniqueInput
  }

  /**
   * CharacterMergeAudit findFirst
   */
  export type CharacterMergeAuditFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * Filter, which CharacterMergeAudit to fetch.
     */
    where?: CharacterMergeAuditWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterMergeAudits to fetch.
     */
    orderBy?: CharacterMergeAuditOrderByWithRelationInput | CharacterMergeAuditOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterMergeAudits.
     */
    cursor?: CharacterMergeAuditWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterMergeAudits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterMergeAudits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterMergeAudits.
     */
    distinct?: CharacterMergeAuditScalarFieldEnum | CharacterMergeAuditScalarFieldEnum[]
  }

  /**
   * CharacterMergeAudit findFirstOrThrow
   */
  export type CharacterMergeAuditFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * Filter, which CharacterMergeAudit to fetch.
     */
    where?: CharacterMergeAuditWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterMergeAudits to fetch.
     */
    orderBy?: CharacterMergeAuditOrderByWithRelationInput | CharacterMergeAuditOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CharacterMergeAudits.
     */
    cursor?: CharacterMergeAuditWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterMergeAudits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterMergeAudits.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CharacterMergeAudits.
     */
    distinct?: CharacterMergeAuditScalarFieldEnum | CharacterMergeAuditScalarFieldEnum[]
  }

  /**
   * CharacterMergeAudit findMany
   */
  export type CharacterMergeAuditFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * Filter, which CharacterMergeAudits to fetch.
     */
    where?: CharacterMergeAuditWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CharacterMergeAudits to fetch.
     */
    orderBy?: CharacterMergeAuditOrderByWithRelationInput | CharacterMergeAuditOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CharacterMergeAudits.
     */
    cursor?: CharacterMergeAuditWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CharacterMergeAudits from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CharacterMergeAudits.
     */
    skip?: number
    distinct?: CharacterMergeAuditScalarFieldEnum | CharacterMergeAuditScalarFieldEnum[]
  }

  /**
   * CharacterMergeAudit create
   */
  export type CharacterMergeAuditCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * The data needed to create a CharacterMergeAudit.
     */
    data: XOR<CharacterMergeAuditCreateInput, CharacterMergeAuditUncheckedCreateInput>
  }

  /**
   * CharacterMergeAudit createMany
   */
  export type CharacterMergeAuditCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CharacterMergeAudits.
     */
    data: CharacterMergeAuditCreateManyInput | CharacterMergeAuditCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CharacterMergeAudit createManyAndReturn
   */
  export type CharacterMergeAuditCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * The data used to create many CharacterMergeAudits.
     */
    data: CharacterMergeAuditCreateManyInput | CharacterMergeAuditCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterMergeAudit update
   */
  export type CharacterMergeAuditUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * The data needed to update a CharacterMergeAudit.
     */
    data: XOR<CharacterMergeAuditUpdateInput, CharacterMergeAuditUncheckedUpdateInput>
    /**
     * Choose, which CharacterMergeAudit to update.
     */
    where: CharacterMergeAuditWhereUniqueInput
  }

  /**
   * CharacterMergeAudit updateMany
   */
  export type CharacterMergeAuditUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CharacterMergeAudits.
     */
    data: XOR<CharacterMergeAuditUpdateManyMutationInput, CharacterMergeAuditUncheckedUpdateManyInput>
    /**
     * Filter which CharacterMergeAudits to update
     */
    where?: CharacterMergeAuditWhereInput
    /**
     * Limit how many CharacterMergeAudits to update.
     */
    limit?: number
  }

  /**
   * CharacterMergeAudit updateManyAndReturn
   */
  export type CharacterMergeAuditUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * The data used to update CharacterMergeAudits.
     */
    data: XOR<CharacterMergeAuditUpdateManyMutationInput, CharacterMergeAuditUncheckedUpdateManyInput>
    /**
     * Filter which CharacterMergeAudits to update
     */
    where?: CharacterMergeAuditWhereInput
    /**
     * Limit how many CharacterMergeAudits to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * CharacterMergeAudit upsert
   */
  export type CharacterMergeAuditUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * The filter to search for the CharacterMergeAudit to update in case it exists.
     */
    where: CharacterMergeAuditWhereUniqueInput
    /**
     * In case the CharacterMergeAudit found by the `where` argument doesn't exist, create a new CharacterMergeAudit with this data.
     */
    create: XOR<CharacterMergeAuditCreateInput, CharacterMergeAuditUncheckedCreateInput>
    /**
     * In case the CharacterMergeAudit was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CharacterMergeAuditUpdateInput, CharacterMergeAuditUncheckedUpdateInput>
  }

  /**
   * CharacterMergeAudit delete
   */
  export type CharacterMergeAuditDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
    /**
     * Filter which CharacterMergeAudit to delete.
     */
    where: CharacterMergeAuditWhereUniqueInput
  }

  /**
   * CharacterMergeAudit deleteMany
   */
  export type CharacterMergeAuditDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CharacterMergeAudits to delete
     */
    where?: CharacterMergeAuditWhereInput
    /**
     * Limit how many CharacterMergeAudits to delete.
     */
    limit?: number
  }

  /**
   * CharacterMergeAudit without action
   */
  export type CharacterMergeAuditDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CharacterMergeAudit
     */
    select?: CharacterMergeAuditSelect<ExtArgs> | null
    /**
     * Omit specific fields from the CharacterMergeAudit
     */
    omit?: CharacterMergeAuditOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CharacterMergeAuditInclude<ExtArgs> | null
  }


  /**
   * Model ProcessingTask
   */

  export type AggregateProcessingTask = {
    _count: ProcessingTaskCountAggregateOutputType | null
    _avg: ProcessingTaskAvgAggregateOutputType | null
    _sum: ProcessingTaskSumAggregateOutputType | null
    _min: ProcessingTaskMinAggregateOutputType | null
    _max: ProcessingTaskMaxAggregateOutputType | null
  }

  export type ProcessingTaskAvgAggregateOutputType = {
    progress: number | null
    totalItems: number | null
    processedItems: number | null
  }

  export type ProcessingTaskSumAggregateOutputType = {
    progress: number | null
    totalItems: number | null
    processedItems: number | null
  }

  export type ProcessingTaskMinAggregateOutputType = {
    id: string | null
    bookId: string | null
    taskType: string | null
    status: string | null
    progress: number | null
    totalItems: number | null
    processedItems: number | null
    errorMessage: string | null
    externalTaskId: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProcessingTaskMaxAggregateOutputType = {
    id: string | null
    bookId: string | null
    taskType: string | null
    status: string | null
    progress: number | null
    totalItems: number | null
    processedItems: number | null
    errorMessage: string | null
    externalTaskId: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ProcessingTaskCountAggregateOutputType = {
    id: number
    bookId: number
    taskType: number
    status: number
    progress: number
    totalItems: number
    processedItems: number
    taskData: number
    errorMessage: number
    externalTaskId: number
    startedAt: number
    completedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ProcessingTaskAvgAggregateInputType = {
    progress?: true
    totalItems?: true
    processedItems?: true
  }

  export type ProcessingTaskSumAggregateInputType = {
    progress?: true
    totalItems?: true
    processedItems?: true
  }

  export type ProcessingTaskMinAggregateInputType = {
    id?: true
    bookId?: true
    taskType?: true
    status?: true
    progress?: true
    totalItems?: true
    processedItems?: true
    errorMessage?: true
    externalTaskId?: true
    startedAt?: true
    completedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProcessingTaskMaxAggregateInputType = {
    id?: true
    bookId?: true
    taskType?: true
    status?: true
    progress?: true
    totalItems?: true
    processedItems?: true
    errorMessage?: true
    externalTaskId?: true
    startedAt?: true
    completedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ProcessingTaskCountAggregateInputType = {
    id?: true
    bookId?: true
    taskType?: true
    status?: true
    progress?: true
    totalItems?: true
    processedItems?: true
    taskData?: true
    errorMessage?: true
    externalTaskId?: true
    startedAt?: true
    completedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ProcessingTaskAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ProcessingTask to aggregate.
     */
    where?: ProcessingTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProcessingTasks to fetch.
     */
    orderBy?: ProcessingTaskOrderByWithRelationInput | ProcessingTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ProcessingTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProcessingTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProcessingTasks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ProcessingTasks
    **/
    _count?: true | ProcessingTaskCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ProcessingTaskAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ProcessingTaskSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ProcessingTaskMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ProcessingTaskMaxAggregateInputType
  }

  export type GetProcessingTaskAggregateType<T extends ProcessingTaskAggregateArgs> = {
        [P in keyof T & keyof AggregateProcessingTask]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateProcessingTask[P]>
      : GetScalarType<T[P], AggregateProcessingTask[P]>
  }




  export type ProcessingTaskGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProcessingTaskWhereInput
    orderBy?: ProcessingTaskOrderByWithAggregationInput | ProcessingTaskOrderByWithAggregationInput[]
    by: ProcessingTaskScalarFieldEnum[] | ProcessingTaskScalarFieldEnum
    having?: ProcessingTaskScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ProcessingTaskCountAggregateInputType | true
    _avg?: ProcessingTaskAvgAggregateInputType
    _sum?: ProcessingTaskSumAggregateInputType
    _min?: ProcessingTaskMinAggregateInputType
    _max?: ProcessingTaskMaxAggregateInputType
  }

  export type ProcessingTaskGroupByOutputType = {
    id: string
    bookId: string
    taskType: string
    status: string
    progress: number
    totalItems: number
    processedItems: number
    taskData: JsonValue
    errorMessage: string | null
    externalTaskId: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: ProcessingTaskCountAggregateOutputType | null
    _avg: ProcessingTaskAvgAggregateOutputType | null
    _sum: ProcessingTaskSumAggregateOutputType | null
    _min: ProcessingTaskMinAggregateOutputType | null
    _max: ProcessingTaskMaxAggregateOutputType | null
  }

  type GetProcessingTaskGroupByPayload<T extends ProcessingTaskGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ProcessingTaskGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ProcessingTaskGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ProcessingTaskGroupByOutputType[P]>
            : GetScalarType<T[P], ProcessingTaskGroupByOutputType[P]>
        }
      >
    >


  export type ProcessingTaskSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    taskType?: boolean
    status?: boolean
    progress?: boolean
    totalItems?: boolean
    processedItems?: boolean
    taskData?: boolean
    errorMessage?: boolean
    externalTaskId?: boolean
    startedAt?: boolean
    completedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["processingTask"]>

  export type ProcessingTaskSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    taskType?: boolean
    status?: boolean
    progress?: boolean
    totalItems?: boolean
    processedItems?: boolean
    taskData?: boolean
    errorMessage?: boolean
    externalTaskId?: boolean
    startedAt?: boolean
    completedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["processingTask"]>

  export type ProcessingTaskSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    bookId?: boolean
    taskType?: boolean
    status?: boolean
    progress?: boolean
    totalItems?: boolean
    processedItems?: boolean
    taskData?: boolean
    errorMessage?: boolean
    externalTaskId?: boolean
    startedAt?: boolean
    completedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    book?: boolean | BookDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["processingTask"]>

  export type ProcessingTaskSelectScalar = {
    id?: boolean
    bookId?: boolean
    taskType?: boolean
    status?: boolean
    progress?: boolean
    totalItems?: boolean
    processedItems?: boolean
    taskData?: boolean
    errorMessage?: boolean
    externalTaskId?: boolean
    startedAt?: boolean
    completedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ProcessingTaskOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "bookId" | "taskType" | "status" | "progress" | "totalItems" | "processedItems" | "taskData" | "errorMessage" | "externalTaskId" | "startedAt" | "completedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["processingTask"]>
  export type ProcessingTaskInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
  }
  export type ProcessingTaskIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
  }
  export type ProcessingTaskIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    book?: boolean | BookDefaultArgs<ExtArgs>
  }

  export type $ProcessingTaskPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ProcessingTask"
    objects: {
      book: Prisma.$BookPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      bookId: string
      taskType: string
      status: string
      progress: number
      totalItems: number
      processedItems: number
      taskData: Prisma.JsonValue
      errorMessage: string | null
      externalTaskId: string | null
      startedAt: Date | null
      completedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["processingTask"]>
    composites: {}
  }

  type ProcessingTaskGetPayload<S extends boolean | null | undefined | ProcessingTaskDefaultArgs> = $Result.GetResult<Prisma.$ProcessingTaskPayload, S>

  type ProcessingTaskCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ProcessingTaskFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ProcessingTaskCountAggregateInputType | true
    }

  export interface ProcessingTaskDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ProcessingTask'], meta: { name: 'ProcessingTask' } }
    /**
     * Find zero or one ProcessingTask that matches the filter.
     * @param {ProcessingTaskFindUniqueArgs} args - Arguments to find a ProcessingTask
     * @example
     * // Get one ProcessingTask
     * const processingTask = await prisma.processingTask.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ProcessingTaskFindUniqueArgs>(args: SelectSubset<T, ProcessingTaskFindUniqueArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ProcessingTask that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ProcessingTaskFindUniqueOrThrowArgs} args - Arguments to find a ProcessingTask
     * @example
     * // Get one ProcessingTask
     * const processingTask = await prisma.processingTask.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ProcessingTaskFindUniqueOrThrowArgs>(args: SelectSubset<T, ProcessingTaskFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ProcessingTask that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProcessingTaskFindFirstArgs} args - Arguments to find a ProcessingTask
     * @example
     * // Get one ProcessingTask
     * const processingTask = await prisma.processingTask.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ProcessingTaskFindFirstArgs>(args?: SelectSubset<T, ProcessingTaskFindFirstArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ProcessingTask that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProcessingTaskFindFirstOrThrowArgs} args - Arguments to find a ProcessingTask
     * @example
     * // Get one ProcessingTask
     * const processingTask = await prisma.processingTask.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ProcessingTaskFindFirstOrThrowArgs>(args?: SelectSubset<T, ProcessingTaskFindFirstOrThrowArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ProcessingTasks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProcessingTaskFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ProcessingTasks
     * const processingTasks = await prisma.processingTask.findMany()
     * 
     * // Get first 10 ProcessingTasks
     * const processingTasks = await prisma.processingTask.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const processingTaskWithIdOnly = await prisma.processingTask.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ProcessingTaskFindManyArgs>(args?: SelectSubset<T, ProcessingTaskFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ProcessingTask.
     * @param {ProcessingTaskCreateArgs} args - Arguments to create a ProcessingTask.
     * @example
     * // Create one ProcessingTask
     * const ProcessingTask = await prisma.processingTask.create({
     *   data: {
     *     // ... data to create a ProcessingTask
     *   }
     * })
     * 
     */
    create<T extends ProcessingTaskCreateArgs>(args: SelectSubset<T, ProcessingTaskCreateArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ProcessingTasks.
     * @param {ProcessingTaskCreateManyArgs} args - Arguments to create many ProcessingTasks.
     * @example
     * // Create many ProcessingTasks
     * const processingTask = await prisma.processingTask.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ProcessingTaskCreateManyArgs>(args?: SelectSubset<T, ProcessingTaskCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ProcessingTasks and returns the data saved in the database.
     * @param {ProcessingTaskCreateManyAndReturnArgs} args - Arguments to create many ProcessingTasks.
     * @example
     * // Create many ProcessingTasks
     * const processingTask = await prisma.processingTask.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ProcessingTasks and only return the `id`
     * const processingTaskWithIdOnly = await prisma.processingTask.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ProcessingTaskCreateManyAndReturnArgs>(args?: SelectSubset<T, ProcessingTaskCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ProcessingTask.
     * @param {ProcessingTaskDeleteArgs} args - Arguments to delete one ProcessingTask.
     * @example
     * // Delete one ProcessingTask
     * const ProcessingTask = await prisma.processingTask.delete({
     *   where: {
     *     // ... filter to delete one ProcessingTask
     *   }
     * })
     * 
     */
    delete<T extends ProcessingTaskDeleteArgs>(args: SelectSubset<T, ProcessingTaskDeleteArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ProcessingTask.
     * @param {ProcessingTaskUpdateArgs} args - Arguments to update one ProcessingTask.
     * @example
     * // Update one ProcessingTask
     * const processingTask = await prisma.processingTask.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ProcessingTaskUpdateArgs>(args: SelectSubset<T, ProcessingTaskUpdateArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ProcessingTasks.
     * @param {ProcessingTaskDeleteManyArgs} args - Arguments to filter ProcessingTasks to delete.
     * @example
     * // Delete a few ProcessingTasks
     * const { count } = await prisma.processingTask.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ProcessingTaskDeleteManyArgs>(args?: SelectSubset<T, ProcessingTaskDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ProcessingTasks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProcessingTaskUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ProcessingTasks
     * const processingTask = await prisma.processingTask.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ProcessingTaskUpdateManyArgs>(args: SelectSubset<T, ProcessingTaskUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ProcessingTasks and returns the data updated in the database.
     * @param {ProcessingTaskUpdateManyAndReturnArgs} args - Arguments to update many ProcessingTasks.
     * @example
     * // Update many ProcessingTasks
     * const processingTask = await prisma.processingTask.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ProcessingTasks and only return the `id`
     * const processingTaskWithIdOnly = await prisma.processingTask.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ProcessingTaskUpdateManyAndReturnArgs>(args: SelectSubset<T, ProcessingTaskUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ProcessingTask.
     * @param {ProcessingTaskUpsertArgs} args - Arguments to update or create a ProcessingTask.
     * @example
     * // Update or create a ProcessingTask
     * const processingTask = await prisma.processingTask.upsert({
     *   create: {
     *     // ... data to create a ProcessingTask
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ProcessingTask we want to update
     *   }
     * })
     */
    upsert<T extends ProcessingTaskUpsertArgs>(args: SelectSubset<T, ProcessingTaskUpsertArgs<ExtArgs>>): Prisma__ProcessingTaskClient<$Result.GetResult<Prisma.$ProcessingTaskPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ProcessingTasks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProcessingTaskCountArgs} args - Arguments to filter ProcessingTasks to count.
     * @example
     * // Count the number of ProcessingTasks
     * const count = await prisma.processingTask.count({
     *   where: {
     *     // ... the filter for the ProcessingTasks we want to count
     *   }
     * })
    **/
    count<T extends ProcessingTaskCountArgs>(
      args?: Subset<T, ProcessingTaskCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ProcessingTaskCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ProcessingTask.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProcessingTaskAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ProcessingTaskAggregateArgs>(args: Subset<T, ProcessingTaskAggregateArgs>): Prisma.PrismaPromise<GetProcessingTaskAggregateType<T>>

    /**
     * Group by ProcessingTask.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProcessingTaskGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ProcessingTaskGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ProcessingTaskGroupByArgs['orderBy'] }
        : { orderBy?: ProcessingTaskGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ProcessingTaskGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetProcessingTaskGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ProcessingTask model
   */
  readonly fields: ProcessingTaskFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ProcessingTask.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ProcessingTaskClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    book<T extends BookDefaultArgs<ExtArgs> = {}>(args?: Subset<T, BookDefaultArgs<ExtArgs>>): Prisma__BookClient<$Result.GetResult<Prisma.$BookPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ProcessingTask model
   */
  interface ProcessingTaskFieldRefs {
    readonly id: FieldRef<"ProcessingTask", 'String'>
    readonly bookId: FieldRef<"ProcessingTask", 'String'>
    readonly taskType: FieldRef<"ProcessingTask", 'String'>
    readonly status: FieldRef<"ProcessingTask", 'String'>
    readonly progress: FieldRef<"ProcessingTask", 'Int'>
    readonly totalItems: FieldRef<"ProcessingTask", 'Int'>
    readonly processedItems: FieldRef<"ProcessingTask", 'Int'>
    readonly taskData: FieldRef<"ProcessingTask", 'Json'>
    readonly errorMessage: FieldRef<"ProcessingTask", 'String'>
    readonly externalTaskId: FieldRef<"ProcessingTask", 'String'>
    readonly startedAt: FieldRef<"ProcessingTask", 'DateTime'>
    readonly completedAt: FieldRef<"ProcessingTask", 'DateTime'>
    readonly createdAt: FieldRef<"ProcessingTask", 'DateTime'>
    readonly updatedAt: FieldRef<"ProcessingTask", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ProcessingTask findUnique
   */
  export type ProcessingTaskFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * Filter, which ProcessingTask to fetch.
     */
    where: ProcessingTaskWhereUniqueInput
  }

  /**
   * ProcessingTask findUniqueOrThrow
   */
  export type ProcessingTaskFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * Filter, which ProcessingTask to fetch.
     */
    where: ProcessingTaskWhereUniqueInput
  }

  /**
   * ProcessingTask findFirst
   */
  export type ProcessingTaskFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * Filter, which ProcessingTask to fetch.
     */
    where?: ProcessingTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProcessingTasks to fetch.
     */
    orderBy?: ProcessingTaskOrderByWithRelationInput | ProcessingTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ProcessingTasks.
     */
    cursor?: ProcessingTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProcessingTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProcessingTasks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ProcessingTasks.
     */
    distinct?: ProcessingTaskScalarFieldEnum | ProcessingTaskScalarFieldEnum[]
  }

  /**
   * ProcessingTask findFirstOrThrow
   */
  export type ProcessingTaskFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * Filter, which ProcessingTask to fetch.
     */
    where?: ProcessingTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProcessingTasks to fetch.
     */
    orderBy?: ProcessingTaskOrderByWithRelationInput | ProcessingTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ProcessingTasks.
     */
    cursor?: ProcessingTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProcessingTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProcessingTasks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ProcessingTasks.
     */
    distinct?: ProcessingTaskScalarFieldEnum | ProcessingTaskScalarFieldEnum[]
  }

  /**
   * ProcessingTask findMany
   */
  export type ProcessingTaskFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * Filter, which ProcessingTasks to fetch.
     */
    where?: ProcessingTaskWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProcessingTasks to fetch.
     */
    orderBy?: ProcessingTaskOrderByWithRelationInput | ProcessingTaskOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ProcessingTasks.
     */
    cursor?: ProcessingTaskWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProcessingTasks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProcessingTasks.
     */
    skip?: number
    distinct?: ProcessingTaskScalarFieldEnum | ProcessingTaskScalarFieldEnum[]
  }

  /**
   * ProcessingTask create
   */
  export type ProcessingTaskCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * The data needed to create a ProcessingTask.
     */
    data: XOR<ProcessingTaskCreateInput, ProcessingTaskUncheckedCreateInput>
  }

  /**
   * ProcessingTask createMany
   */
  export type ProcessingTaskCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ProcessingTasks.
     */
    data: ProcessingTaskCreateManyInput | ProcessingTaskCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ProcessingTask createManyAndReturn
   */
  export type ProcessingTaskCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * The data used to create many ProcessingTasks.
     */
    data: ProcessingTaskCreateManyInput | ProcessingTaskCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ProcessingTask update
   */
  export type ProcessingTaskUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * The data needed to update a ProcessingTask.
     */
    data: XOR<ProcessingTaskUpdateInput, ProcessingTaskUncheckedUpdateInput>
    /**
     * Choose, which ProcessingTask to update.
     */
    where: ProcessingTaskWhereUniqueInput
  }

  /**
   * ProcessingTask updateMany
   */
  export type ProcessingTaskUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ProcessingTasks.
     */
    data: XOR<ProcessingTaskUpdateManyMutationInput, ProcessingTaskUncheckedUpdateManyInput>
    /**
     * Filter which ProcessingTasks to update
     */
    where?: ProcessingTaskWhereInput
    /**
     * Limit how many ProcessingTasks to update.
     */
    limit?: number
  }

  /**
   * ProcessingTask updateManyAndReturn
   */
  export type ProcessingTaskUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * The data used to update ProcessingTasks.
     */
    data: XOR<ProcessingTaskUpdateManyMutationInput, ProcessingTaskUncheckedUpdateManyInput>
    /**
     * Filter which ProcessingTasks to update
     */
    where?: ProcessingTaskWhereInput
    /**
     * Limit how many ProcessingTasks to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ProcessingTask upsert
   */
  export type ProcessingTaskUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * The filter to search for the ProcessingTask to update in case it exists.
     */
    where: ProcessingTaskWhereUniqueInput
    /**
     * In case the ProcessingTask found by the `where` argument doesn't exist, create a new ProcessingTask with this data.
     */
    create: XOR<ProcessingTaskCreateInput, ProcessingTaskUncheckedCreateInput>
    /**
     * In case the ProcessingTask was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ProcessingTaskUpdateInput, ProcessingTaskUncheckedUpdateInput>
  }

  /**
   * ProcessingTask delete
   */
  export type ProcessingTaskDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
    /**
     * Filter which ProcessingTask to delete.
     */
    where: ProcessingTaskWhereUniqueInput
  }

  /**
   * ProcessingTask deleteMany
   */
  export type ProcessingTaskDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ProcessingTasks to delete
     */
    where?: ProcessingTaskWhereInput
    /**
     * Limit how many ProcessingTasks to delete.
     */
    limit?: number
  }

  /**
   * ProcessingTask without action
   */
  export type ProcessingTaskDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProcessingTask
     */
    select?: ProcessingTaskSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProcessingTask
     */
    omit?: ProcessingTaskOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProcessingTaskInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const BookScalarFieldEnum: {
    id: 'id',
    title: 'title',
    author: 'author',
    originalFilename: 'originalFilename',
    uploadedFilePath: 'uploadedFilePath',
    fileSize: 'fileSize',
    totalWords: 'totalWords',
    totalCharacters: 'totalCharacters',
    totalSegments: 'totalSegments',
    encoding: 'encoding',
    fileFormat: 'fileFormat',
    status: 'status',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type BookScalarFieldEnum = (typeof BookScalarFieldEnum)[keyof typeof BookScalarFieldEnum]


  export const CharacterProfileScalarFieldEnum: {
    id: 'id',
    bookId: 'bookId',
    canonicalName: 'canonicalName',
    characteristics: 'characteristics',
    voicePreferences: 'voicePreferences',
    emotionProfile: 'emotionProfile',
    genderHint: 'genderHint',
    ageHint: 'ageHint',
    emotionBaseline: 'emotionBaseline',
    isActive: 'isActive',
    mentions: 'mentions',
    quotes: 'quotes',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CharacterProfileScalarFieldEnum = (typeof CharacterProfileScalarFieldEnum)[keyof typeof CharacterProfileScalarFieldEnum]


  export const CharacterAliasScalarFieldEnum: {
    id: 'id',
    characterId: 'characterId',
    alias: 'alias',
    confidence: 'confidence',
    sourceSentence: 'sourceSentence',
    createdAt: 'createdAt'
  };

  export type CharacterAliasScalarFieldEnum = (typeof CharacterAliasScalarFieldEnum)[keyof typeof CharacterAliasScalarFieldEnum]


  export const TTSVoiceProfileScalarFieldEnum: {
    id: 'id',
    provider: 'provider',
    voiceId: 'voiceId',
    voiceName: 'voiceName',
    displayName: 'displayName',
    description: 'description',
    characteristics: 'characteristics',
    defaultParameters: 'defaultParameters',
    previewAudio: 'previewAudio',
    usageCount: 'usageCount',
    rating: 'rating',
    isAvailable: 'isAvailable',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TTSVoiceProfileScalarFieldEnum = (typeof TTSVoiceProfileScalarFieldEnum)[keyof typeof TTSVoiceProfileScalarFieldEnum]


  export const CharacterVoiceBindingScalarFieldEnum: {
    id: 'id',
    characterId: 'characterId',
    voiceProfileId: 'voiceProfileId',
    customParameters: 'customParameters',
    emotionMappings: 'emotionMappings',
    isDefault: 'isDefault',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CharacterVoiceBindingScalarFieldEnum = (typeof CharacterVoiceBindingScalarFieldEnum)[keyof typeof CharacterVoiceBindingScalarFieldEnum]


  export const TextSegmentScalarFieldEnum: {
    id: 'id',
    bookId: 'bookId',
    segmentIndex: 'segmentIndex',
    startPosition: 'startPosition',
    endPosition: 'endPosition',
    content: 'content',
    wordCount: 'wordCount',
    segmentType: 'segmentType',
    orderIndex: 'orderIndex',
    metadata: 'metadata',
    status: 'status',
    createdAt: 'createdAt'
  };

  export type TextSegmentScalarFieldEnum = (typeof TextSegmentScalarFieldEnum)[keyof typeof TextSegmentScalarFieldEnum]


  export const ScriptSentenceScalarFieldEnum: {
    id: 'id',
    bookId: 'bookId',
    segmentId: 'segmentId',
    characterId: 'characterId',
    rawSpeaker: 'rawSpeaker',
    text: 'text',
    orderInSegment: 'orderInSegment',
    tone: 'tone',
    strength: 'strength',
    pauseAfter: 'pauseAfter',
    ttsParameters: 'ttsParameters',
    createdAt: 'createdAt'
  };

  export type ScriptSentenceScalarFieldEnum = (typeof ScriptSentenceScalarFieldEnum)[keyof typeof ScriptSentenceScalarFieldEnum]


  export const AudioFileScalarFieldEnum: {
    id: 'id',
    bookId: 'bookId',
    sentenceId: 'sentenceId',
    segmentId: 'segmentId',
    filePath: 'filePath',
    fileName: 'fileName',
    duration: 'duration',
    fileSize: 'fileSize',
    format: 'format',
    status: 'status',
    errorMessage: 'errorMessage',
    retryCount: 'retryCount',
    provider: 'provider',
    voiceProfileId: 'voiceProfileId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AudioFileScalarFieldEnum = (typeof AudioFileScalarFieldEnum)[keyof typeof AudioFileScalarFieldEnum]


  export const CharacterMergeAuditScalarFieldEnum: {
    id: 'id',
    bookId: 'bookId',
    sourceCharacterId: 'sourceCharacterId',
    targetCharacterId: 'targetCharacterId',
    mergeReason: 'mergeReason',
    mergedBy: 'mergedBy',
    createdAt: 'createdAt'
  };

  export type CharacterMergeAuditScalarFieldEnum = (typeof CharacterMergeAuditScalarFieldEnum)[keyof typeof CharacterMergeAuditScalarFieldEnum]


  export const ProcessingTaskScalarFieldEnum: {
    id: 'id',
    bookId: 'bookId',
    taskType: 'taskType',
    status: 'status',
    progress: 'progress',
    totalItems: 'totalItems',
    processedItems: 'processedItems',
    taskData: 'taskData',
    errorMessage: 'errorMessage',
    externalTaskId: 'externalTaskId',
    startedAt: 'startedAt',
    completedAt: 'completedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ProcessingTaskScalarFieldEnum = (typeof ProcessingTaskScalarFieldEnum)[keyof typeof ProcessingTaskScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'BigInt'
   */
  export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt'>
    


  /**
   * Reference to a field of type 'BigInt[]'
   */
  export type ListBigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BigInt[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type BookWhereInput = {
    AND?: BookWhereInput | BookWhereInput[]
    OR?: BookWhereInput[]
    NOT?: BookWhereInput | BookWhereInput[]
    id?: StringFilter<"Book"> | string
    title?: StringFilter<"Book"> | string
    author?: StringNullableFilter<"Book"> | string | null
    originalFilename?: StringNullableFilter<"Book"> | string | null
    uploadedFilePath?: StringNullableFilter<"Book"> | string | null
    fileSize?: BigIntNullableFilter<"Book"> | bigint | number | null
    totalWords?: IntNullableFilter<"Book"> | number | null
    totalCharacters?: IntFilter<"Book"> | number
    totalSegments?: IntFilter<"Book"> | number
    encoding?: StringNullableFilter<"Book"> | string | null
    fileFormat?: StringNullableFilter<"Book"> | string | null
    status?: StringFilter<"Book"> | string
    metadata?: JsonFilter<"Book">
    createdAt?: DateTimeFilter<"Book"> | Date | string
    updatedAt?: DateTimeFilter<"Book"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    mergeAudits?: CharacterMergeAuditListRelationFilter
    characterProfiles?: CharacterProfileListRelationFilter
    processingTasks?: ProcessingTaskListRelationFilter
    scriptSentences?: ScriptSentenceListRelationFilter
    textSegments?: TextSegmentListRelationFilter
  }

  export type BookOrderByWithRelationInput = {
    id?: SortOrder
    title?: SortOrder
    author?: SortOrderInput | SortOrder
    originalFilename?: SortOrderInput | SortOrder
    uploadedFilePath?: SortOrderInput | SortOrder
    fileSize?: SortOrderInput | SortOrder
    totalWords?: SortOrderInput | SortOrder
    totalCharacters?: SortOrder
    totalSegments?: SortOrder
    encoding?: SortOrderInput | SortOrder
    fileFormat?: SortOrderInput | SortOrder
    status?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    audioFiles?: AudioFileOrderByRelationAggregateInput
    mergeAudits?: CharacterMergeAuditOrderByRelationAggregateInput
    characterProfiles?: CharacterProfileOrderByRelationAggregateInput
    processingTasks?: ProcessingTaskOrderByRelationAggregateInput
    scriptSentences?: ScriptSentenceOrderByRelationAggregateInput
    textSegments?: TextSegmentOrderByRelationAggregateInput
  }

  export type BookWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: BookWhereInput | BookWhereInput[]
    OR?: BookWhereInput[]
    NOT?: BookWhereInput | BookWhereInput[]
    title?: StringFilter<"Book"> | string
    author?: StringNullableFilter<"Book"> | string | null
    originalFilename?: StringNullableFilter<"Book"> | string | null
    uploadedFilePath?: StringNullableFilter<"Book"> | string | null
    fileSize?: BigIntNullableFilter<"Book"> | bigint | number | null
    totalWords?: IntNullableFilter<"Book"> | number | null
    totalCharacters?: IntFilter<"Book"> | number
    totalSegments?: IntFilter<"Book"> | number
    encoding?: StringNullableFilter<"Book"> | string | null
    fileFormat?: StringNullableFilter<"Book"> | string | null
    status?: StringFilter<"Book"> | string
    metadata?: JsonFilter<"Book">
    createdAt?: DateTimeFilter<"Book"> | Date | string
    updatedAt?: DateTimeFilter<"Book"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    mergeAudits?: CharacterMergeAuditListRelationFilter
    characterProfiles?: CharacterProfileListRelationFilter
    processingTasks?: ProcessingTaskListRelationFilter
    scriptSentences?: ScriptSentenceListRelationFilter
    textSegments?: TextSegmentListRelationFilter
  }, "id">

  export type BookOrderByWithAggregationInput = {
    id?: SortOrder
    title?: SortOrder
    author?: SortOrderInput | SortOrder
    originalFilename?: SortOrderInput | SortOrder
    uploadedFilePath?: SortOrderInput | SortOrder
    fileSize?: SortOrderInput | SortOrder
    totalWords?: SortOrderInput | SortOrder
    totalCharacters?: SortOrder
    totalSegments?: SortOrder
    encoding?: SortOrderInput | SortOrder
    fileFormat?: SortOrderInput | SortOrder
    status?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: BookCountOrderByAggregateInput
    _avg?: BookAvgOrderByAggregateInput
    _max?: BookMaxOrderByAggregateInput
    _min?: BookMinOrderByAggregateInput
    _sum?: BookSumOrderByAggregateInput
  }

  export type BookScalarWhereWithAggregatesInput = {
    AND?: BookScalarWhereWithAggregatesInput | BookScalarWhereWithAggregatesInput[]
    OR?: BookScalarWhereWithAggregatesInput[]
    NOT?: BookScalarWhereWithAggregatesInput | BookScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Book"> | string
    title?: StringWithAggregatesFilter<"Book"> | string
    author?: StringNullableWithAggregatesFilter<"Book"> | string | null
    originalFilename?: StringNullableWithAggregatesFilter<"Book"> | string | null
    uploadedFilePath?: StringNullableWithAggregatesFilter<"Book"> | string | null
    fileSize?: BigIntNullableWithAggregatesFilter<"Book"> | bigint | number | null
    totalWords?: IntNullableWithAggregatesFilter<"Book"> | number | null
    totalCharacters?: IntWithAggregatesFilter<"Book"> | number
    totalSegments?: IntWithAggregatesFilter<"Book"> | number
    encoding?: StringNullableWithAggregatesFilter<"Book"> | string | null
    fileFormat?: StringNullableWithAggregatesFilter<"Book"> | string | null
    status?: StringWithAggregatesFilter<"Book"> | string
    metadata?: JsonWithAggregatesFilter<"Book">
    createdAt?: DateTimeWithAggregatesFilter<"Book"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Book"> | Date | string
  }

  export type CharacterProfileWhereInput = {
    AND?: CharacterProfileWhereInput | CharacterProfileWhereInput[]
    OR?: CharacterProfileWhereInput[]
    NOT?: CharacterProfileWhereInput | CharacterProfileWhereInput[]
    id?: StringFilter<"CharacterProfile"> | string
    bookId?: StringFilter<"CharacterProfile"> | string
    canonicalName?: StringFilter<"CharacterProfile"> | string
    characteristics?: JsonFilter<"CharacterProfile">
    voicePreferences?: JsonFilter<"CharacterProfile">
    emotionProfile?: JsonFilter<"CharacterProfile">
    genderHint?: StringFilter<"CharacterProfile"> | string
    ageHint?: IntNullableFilter<"CharacterProfile"> | number | null
    emotionBaseline?: StringFilter<"CharacterProfile"> | string
    isActive?: BoolFilter<"CharacterProfile"> | boolean
    mentions?: IntNullableFilter<"CharacterProfile"> | number | null
    quotes?: IntNullableFilter<"CharacterProfile"> | number | null
    createdAt?: DateTimeFilter<"CharacterProfile"> | Date | string
    updatedAt?: DateTimeFilter<"CharacterProfile"> | Date | string
    aliases?: CharacterAliasListRelationFilter
    mergeAuditsSource?: CharacterMergeAuditListRelationFilter
    mergeAuditsTarget?: CharacterMergeAuditListRelationFilter
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    voiceBindings?: CharacterVoiceBindingListRelationFilter
    scriptSentences?: ScriptSentenceListRelationFilter
  }

  export type CharacterProfileOrderByWithRelationInput = {
    id?: SortOrder
    bookId?: SortOrder
    canonicalName?: SortOrder
    characteristics?: SortOrder
    voicePreferences?: SortOrder
    emotionProfile?: SortOrder
    genderHint?: SortOrder
    ageHint?: SortOrderInput | SortOrder
    emotionBaseline?: SortOrder
    isActive?: SortOrder
    mentions?: SortOrderInput | SortOrder
    quotes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    aliases?: CharacterAliasOrderByRelationAggregateInput
    mergeAuditsSource?: CharacterMergeAuditOrderByRelationAggregateInput
    mergeAuditsTarget?: CharacterMergeAuditOrderByRelationAggregateInput
    book?: BookOrderByWithRelationInput
    voiceBindings?: CharacterVoiceBindingOrderByRelationAggregateInput
    scriptSentences?: ScriptSentenceOrderByRelationAggregateInput
  }

  export type CharacterProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CharacterProfileWhereInput | CharacterProfileWhereInput[]
    OR?: CharacterProfileWhereInput[]
    NOT?: CharacterProfileWhereInput | CharacterProfileWhereInput[]
    bookId?: StringFilter<"CharacterProfile"> | string
    canonicalName?: StringFilter<"CharacterProfile"> | string
    characteristics?: JsonFilter<"CharacterProfile">
    voicePreferences?: JsonFilter<"CharacterProfile">
    emotionProfile?: JsonFilter<"CharacterProfile">
    genderHint?: StringFilter<"CharacterProfile"> | string
    ageHint?: IntNullableFilter<"CharacterProfile"> | number | null
    emotionBaseline?: StringFilter<"CharacterProfile"> | string
    isActive?: BoolFilter<"CharacterProfile"> | boolean
    mentions?: IntNullableFilter<"CharacterProfile"> | number | null
    quotes?: IntNullableFilter<"CharacterProfile"> | number | null
    createdAt?: DateTimeFilter<"CharacterProfile"> | Date | string
    updatedAt?: DateTimeFilter<"CharacterProfile"> | Date | string
    aliases?: CharacterAliasListRelationFilter
    mergeAuditsSource?: CharacterMergeAuditListRelationFilter
    mergeAuditsTarget?: CharacterMergeAuditListRelationFilter
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    voiceBindings?: CharacterVoiceBindingListRelationFilter
    scriptSentences?: ScriptSentenceListRelationFilter
  }, "id">

  export type CharacterProfileOrderByWithAggregationInput = {
    id?: SortOrder
    bookId?: SortOrder
    canonicalName?: SortOrder
    characteristics?: SortOrder
    voicePreferences?: SortOrder
    emotionProfile?: SortOrder
    genderHint?: SortOrder
    ageHint?: SortOrderInput | SortOrder
    emotionBaseline?: SortOrder
    isActive?: SortOrder
    mentions?: SortOrderInput | SortOrder
    quotes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CharacterProfileCountOrderByAggregateInput
    _avg?: CharacterProfileAvgOrderByAggregateInput
    _max?: CharacterProfileMaxOrderByAggregateInput
    _min?: CharacterProfileMinOrderByAggregateInput
    _sum?: CharacterProfileSumOrderByAggregateInput
  }

  export type CharacterProfileScalarWhereWithAggregatesInput = {
    AND?: CharacterProfileScalarWhereWithAggregatesInput | CharacterProfileScalarWhereWithAggregatesInput[]
    OR?: CharacterProfileScalarWhereWithAggregatesInput[]
    NOT?: CharacterProfileScalarWhereWithAggregatesInput | CharacterProfileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CharacterProfile"> | string
    bookId?: StringWithAggregatesFilter<"CharacterProfile"> | string
    canonicalName?: StringWithAggregatesFilter<"CharacterProfile"> | string
    characteristics?: JsonWithAggregatesFilter<"CharacterProfile">
    voicePreferences?: JsonWithAggregatesFilter<"CharacterProfile">
    emotionProfile?: JsonWithAggregatesFilter<"CharacterProfile">
    genderHint?: StringWithAggregatesFilter<"CharacterProfile"> | string
    ageHint?: IntNullableWithAggregatesFilter<"CharacterProfile"> | number | null
    emotionBaseline?: StringWithAggregatesFilter<"CharacterProfile"> | string
    isActive?: BoolWithAggregatesFilter<"CharacterProfile"> | boolean
    mentions?: IntNullableWithAggregatesFilter<"CharacterProfile"> | number | null
    quotes?: IntNullableWithAggregatesFilter<"CharacterProfile"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"CharacterProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CharacterProfile"> | Date | string
  }

  export type CharacterAliasWhereInput = {
    AND?: CharacterAliasWhereInput | CharacterAliasWhereInput[]
    OR?: CharacterAliasWhereInput[]
    NOT?: CharacterAliasWhereInput | CharacterAliasWhereInput[]
    id?: StringFilter<"CharacterAlias"> | string
    characterId?: StringFilter<"CharacterAlias"> | string
    alias?: StringFilter<"CharacterAlias"> | string
    confidence?: DecimalFilter<"CharacterAlias"> | Decimal | DecimalJsLike | number | string
    sourceSentence?: StringNullableFilter<"CharacterAlias"> | string | null
    createdAt?: DateTimeFilter<"CharacterAlias"> | Date | string
    character?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
  }

  export type CharacterAliasOrderByWithRelationInput = {
    id?: SortOrder
    characterId?: SortOrder
    alias?: SortOrder
    confidence?: SortOrder
    sourceSentence?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    character?: CharacterProfileOrderByWithRelationInput
  }

  export type CharacterAliasWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CharacterAliasWhereInput | CharacterAliasWhereInput[]
    OR?: CharacterAliasWhereInput[]
    NOT?: CharacterAliasWhereInput | CharacterAliasWhereInput[]
    characterId?: StringFilter<"CharacterAlias"> | string
    alias?: StringFilter<"CharacterAlias"> | string
    confidence?: DecimalFilter<"CharacterAlias"> | Decimal | DecimalJsLike | number | string
    sourceSentence?: StringNullableFilter<"CharacterAlias"> | string | null
    createdAt?: DateTimeFilter<"CharacterAlias"> | Date | string
    character?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
  }, "id">

  export type CharacterAliasOrderByWithAggregationInput = {
    id?: SortOrder
    characterId?: SortOrder
    alias?: SortOrder
    confidence?: SortOrder
    sourceSentence?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: CharacterAliasCountOrderByAggregateInput
    _avg?: CharacterAliasAvgOrderByAggregateInput
    _max?: CharacterAliasMaxOrderByAggregateInput
    _min?: CharacterAliasMinOrderByAggregateInput
    _sum?: CharacterAliasSumOrderByAggregateInput
  }

  export type CharacterAliasScalarWhereWithAggregatesInput = {
    AND?: CharacterAliasScalarWhereWithAggregatesInput | CharacterAliasScalarWhereWithAggregatesInput[]
    OR?: CharacterAliasScalarWhereWithAggregatesInput[]
    NOT?: CharacterAliasScalarWhereWithAggregatesInput | CharacterAliasScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CharacterAlias"> | string
    characterId?: StringWithAggregatesFilter<"CharacterAlias"> | string
    alias?: StringWithAggregatesFilter<"CharacterAlias"> | string
    confidence?: DecimalWithAggregatesFilter<"CharacterAlias"> | Decimal | DecimalJsLike | number | string
    sourceSentence?: StringNullableWithAggregatesFilter<"CharacterAlias"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"CharacterAlias"> | Date | string
  }

  export type TTSVoiceProfileWhereInput = {
    AND?: TTSVoiceProfileWhereInput | TTSVoiceProfileWhereInput[]
    OR?: TTSVoiceProfileWhereInput[]
    NOT?: TTSVoiceProfileWhereInput | TTSVoiceProfileWhereInput[]
    id?: StringFilter<"TTSVoiceProfile"> | string
    provider?: StringFilter<"TTSVoiceProfile"> | string
    voiceId?: StringFilter<"TTSVoiceProfile"> | string
    voiceName?: StringFilter<"TTSVoiceProfile"> | string
    displayName?: StringFilter<"TTSVoiceProfile"> | string
    description?: StringNullableFilter<"TTSVoiceProfile"> | string | null
    characteristics?: JsonFilter<"TTSVoiceProfile">
    defaultParameters?: JsonFilter<"TTSVoiceProfile">
    previewAudio?: JsonNullableFilter<"TTSVoiceProfile">
    usageCount?: IntFilter<"TTSVoiceProfile"> | number
    rating?: DecimalFilter<"TTSVoiceProfile"> | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFilter<"TTSVoiceProfile"> | boolean
    createdAt?: DateTimeFilter<"TTSVoiceProfile"> | Date | string
    updatedAt?: DateTimeFilter<"TTSVoiceProfile"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    voiceBindings?: CharacterVoiceBindingListRelationFilter
  }

  export type TTSVoiceProfileOrderByWithRelationInput = {
    id?: SortOrder
    provider?: SortOrder
    voiceId?: SortOrder
    voiceName?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    characteristics?: SortOrder
    defaultParameters?: SortOrder
    previewAudio?: SortOrderInput | SortOrder
    usageCount?: SortOrder
    rating?: SortOrder
    isAvailable?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    audioFiles?: AudioFileOrderByRelationAggregateInput
    voiceBindings?: CharacterVoiceBindingOrderByRelationAggregateInput
  }

  export type TTSVoiceProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TTSVoiceProfileWhereInput | TTSVoiceProfileWhereInput[]
    OR?: TTSVoiceProfileWhereInput[]
    NOT?: TTSVoiceProfileWhereInput | TTSVoiceProfileWhereInput[]
    provider?: StringFilter<"TTSVoiceProfile"> | string
    voiceId?: StringFilter<"TTSVoiceProfile"> | string
    voiceName?: StringFilter<"TTSVoiceProfile"> | string
    displayName?: StringFilter<"TTSVoiceProfile"> | string
    description?: StringNullableFilter<"TTSVoiceProfile"> | string | null
    characteristics?: JsonFilter<"TTSVoiceProfile">
    defaultParameters?: JsonFilter<"TTSVoiceProfile">
    previewAudio?: JsonNullableFilter<"TTSVoiceProfile">
    usageCount?: IntFilter<"TTSVoiceProfile"> | number
    rating?: DecimalFilter<"TTSVoiceProfile"> | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFilter<"TTSVoiceProfile"> | boolean
    createdAt?: DateTimeFilter<"TTSVoiceProfile"> | Date | string
    updatedAt?: DateTimeFilter<"TTSVoiceProfile"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    voiceBindings?: CharacterVoiceBindingListRelationFilter
  }, "id">

  export type TTSVoiceProfileOrderByWithAggregationInput = {
    id?: SortOrder
    provider?: SortOrder
    voiceId?: SortOrder
    voiceName?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    characteristics?: SortOrder
    defaultParameters?: SortOrder
    previewAudio?: SortOrderInput | SortOrder
    usageCount?: SortOrder
    rating?: SortOrder
    isAvailable?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TTSVoiceProfileCountOrderByAggregateInput
    _avg?: TTSVoiceProfileAvgOrderByAggregateInput
    _max?: TTSVoiceProfileMaxOrderByAggregateInput
    _min?: TTSVoiceProfileMinOrderByAggregateInput
    _sum?: TTSVoiceProfileSumOrderByAggregateInput
  }

  export type TTSVoiceProfileScalarWhereWithAggregatesInput = {
    AND?: TTSVoiceProfileScalarWhereWithAggregatesInput | TTSVoiceProfileScalarWhereWithAggregatesInput[]
    OR?: TTSVoiceProfileScalarWhereWithAggregatesInput[]
    NOT?: TTSVoiceProfileScalarWhereWithAggregatesInput | TTSVoiceProfileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TTSVoiceProfile"> | string
    provider?: StringWithAggregatesFilter<"TTSVoiceProfile"> | string
    voiceId?: StringWithAggregatesFilter<"TTSVoiceProfile"> | string
    voiceName?: StringWithAggregatesFilter<"TTSVoiceProfile"> | string
    displayName?: StringWithAggregatesFilter<"TTSVoiceProfile"> | string
    description?: StringNullableWithAggregatesFilter<"TTSVoiceProfile"> | string | null
    characteristics?: JsonWithAggregatesFilter<"TTSVoiceProfile">
    defaultParameters?: JsonWithAggregatesFilter<"TTSVoiceProfile">
    previewAudio?: JsonNullableWithAggregatesFilter<"TTSVoiceProfile">
    usageCount?: IntWithAggregatesFilter<"TTSVoiceProfile"> | number
    rating?: DecimalWithAggregatesFilter<"TTSVoiceProfile"> | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolWithAggregatesFilter<"TTSVoiceProfile"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"TTSVoiceProfile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TTSVoiceProfile"> | Date | string
  }

  export type CharacterVoiceBindingWhereInput = {
    AND?: CharacterVoiceBindingWhereInput | CharacterVoiceBindingWhereInput[]
    OR?: CharacterVoiceBindingWhereInput[]
    NOT?: CharacterVoiceBindingWhereInput | CharacterVoiceBindingWhereInput[]
    id?: StringFilter<"CharacterVoiceBinding"> | string
    characterId?: StringFilter<"CharacterVoiceBinding"> | string
    voiceProfileId?: StringFilter<"CharacterVoiceBinding"> | string
    customParameters?: JsonNullableFilter<"CharacterVoiceBinding">
    emotionMappings?: JsonFilter<"CharacterVoiceBinding">
    isDefault?: BoolFilter<"CharacterVoiceBinding"> | boolean
    createdAt?: DateTimeFilter<"CharacterVoiceBinding"> | Date | string
    updatedAt?: DateTimeFilter<"CharacterVoiceBinding"> | Date | string
    character?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
    voiceProfile?: XOR<TTSVoiceProfileScalarRelationFilter, TTSVoiceProfileWhereInput>
  }

  export type CharacterVoiceBindingOrderByWithRelationInput = {
    id?: SortOrder
    characterId?: SortOrder
    voiceProfileId?: SortOrder
    customParameters?: SortOrderInput | SortOrder
    emotionMappings?: SortOrder
    isDefault?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    character?: CharacterProfileOrderByWithRelationInput
    voiceProfile?: TTSVoiceProfileOrderByWithRelationInput
  }

  export type CharacterVoiceBindingWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    characterId_voiceProfileId?: CharacterVoiceBindingCharacterIdVoiceProfileIdCompoundUniqueInput
    AND?: CharacterVoiceBindingWhereInput | CharacterVoiceBindingWhereInput[]
    OR?: CharacterVoiceBindingWhereInput[]
    NOT?: CharacterVoiceBindingWhereInput | CharacterVoiceBindingWhereInput[]
    characterId?: StringFilter<"CharacterVoiceBinding"> | string
    voiceProfileId?: StringFilter<"CharacterVoiceBinding"> | string
    customParameters?: JsonNullableFilter<"CharacterVoiceBinding">
    emotionMappings?: JsonFilter<"CharacterVoiceBinding">
    isDefault?: BoolFilter<"CharacterVoiceBinding"> | boolean
    createdAt?: DateTimeFilter<"CharacterVoiceBinding"> | Date | string
    updatedAt?: DateTimeFilter<"CharacterVoiceBinding"> | Date | string
    character?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
    voiceProfile?: XOR<TTSVoiceProfileScalarRelationFilter, TTSVoiceProfileWhereInput>
  }, "id" | "characterId_voiceProfileId">

  export type CharacterVoiceBindingOrderByWithAggregationInput = {
    id?: SortOrder
    characterId?: SortOrder
    voiceProfileId?: SortOrder
    customParameters?: SortOrderInput | SortOrder
    emotionMappings?: SortOrder
    isDefault?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CharacterVoiceBindingCountOrderByAggregateInput
    _max?: CharacterVoiceBindingMaxOrderByAggregateInput
    _min?: CharacterVoiceBindingMinOrderByAggregateInput
  }

  export type CharacterVoiceBindingScalarWhereWithAggregatesInput = {
    AND?: CharacterVoiceBindingScalarWhereWithAggregatesInput | CharacterVoiceBindingScalarWhereWithAggregatesInput[]
    OR?: CharacterVoiceBindingScalarWhereWithAggregatesInput[]
    NOT?: CharacterVoiceBindingScalarWhereWithAggregatesInput | CharacterVoiceBindingScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CharacterVoiceBinding"> | string
    characterId?: StringWithAggregatesFilter<"CharacterVoiceBinding"> | string
    voiceProfileId?: StringWithAggregatesFilter<"CharacterVoiceBinding"> | string
    customParameters?: JsonNullableWithAggregatesFilter<"CharacterVoiceBinding">
    emotionMappings?: JsonWithAggregatesFilter<"CharacterVoiceBinding">
    isDefault?: BoolWithAggregatesFilter<"CharacterVoiceBinding"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"CharacterVoiceBinding"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"CharacterVoiceBinding"> | Date | string
  }

  export type TextSegmentWhereInput = {
    AND?: TextSegmentWhereInput | TextSegmentWhereInput[]
    OR?: TextSegmentWhereInput[]
    NOT?: TextSegmentWhereInput | TextSegmentWhereInput[]
    id?: StringFilter<"TextSegment"> | string
    bookId?: StringFilter<"TextSegment"> | string
    segmentIndex?: IntFilter<"TextSegment"> | number
    startPosition?: IntFilter<"TextSegment"> | number
    endPosition?: IntFilter<"TextSegment"> | number
    content?: StringFilter<"TextSegment"> | string
    wordCount?: IntNullableFilter<"TextSegment"> | number | null
    segmentType?: StringNullableFilter<"TextSegment"> | string | null
    orderIndex?: IntFilter<"TextSegment"> | number
    metadata?: JsonNullableFilter<"TextSegment">
    status?: StringFilter<"TextSegment"> | string
    createdAt?: DateTimeFilter<"TextSegment"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    scriptSentences?: ScriptSentenceListRelationFilter
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
  }

  export type TextSegmentOrderByWithRelationInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentIndex?: SortOrder
    startPosition?: SortOrder
    endPosition?: SortOrder
    content?: SortOrder
    wordCount?: SortOrderInput | SortOrder
    segmentType?: SortOrderInput | SortOrder
    orderIndex?: SortOrder
    metadata?: SortOrderInput | SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    audioFiles?: AudioFileOrderByRelationAggregateInput
    scriptSentences?: ScriptSentenceOrderByRelationAggregateInput
    book?: BookOrderByWithRelationInput
  }

  export type TextSegmentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TextSegmentWhereInput | TextSegmentWhereInput[]
    OR?: TextSegmentWhereInput[]
    NOT?: TextSegmentWhereInput | TextSegmentWhereInput[]
    bookId?: StringFilter<"TextSegment"> | string
    segmentIndex?: IntFilter<"TextSegment"> | number
    startPosition?: IntFilter<"TextSegment"> | number
    endPosition?: IntFilter<"TextSegment"> | number
    content?: StringFilter<"TextSegment"> | string
    wordCount?: IntNullableFilter<"TextSegment"> | number | null
    segmentType?: StringNullableFilter<"TextSegment"> | string | null
    orderIndex?: IntFilter<"TextSegment"> | number
    metadata?: JsonNullableFilter<"TextSegment">
    status?: StringFilter<"TextSegment"> | string
    createdAt?: DateTimeFilter<"TextSegment"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    scriptSentences?: ScriptSentenceListRelationFilter
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
  }, "id">

  export type TextSegmentOrderByWithAggregationInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentIndex?: SortOrder
    startPosition?: SortOrder
    endPosition?: SortOrder
    content?: SortOrder
    wordCount?: SortOrderInput | SortOrder
    segmentType?: SortOrderInput | SortOrder
    orderIndex?: SortOrder
    metadata?: SortOrderInput | SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    _count?: TextSegmentCountOrderByAggregateInput
    _avg?: TextSegmentAvgOrderByAggregateInput
    _max?: TextSegmentMaxOrderByAggregateInput
    _min?: TextSegmentMinOrderByAggregateInput
    _sum?: TextSegmentSumOrderByAggregateInput
  }

  export type TextSegmentScalarWhereWithAggregatesInput = {
    AND?: TextSegmentScalarWhereWithAggregatesInput | TextSegmentScalarWhereWithAggregatesInput[]
    OR?: TextSegmentScalarWhereWithAggregatesInput[]
    NOT?: TextSegmentScalarWhereWithAggregatesInput | TextSegmentScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"TextSegment"> | string
    bookId?: StringWithAggregatesFilter<"TextSegment"> | string
    segmentIndex?: IntWithAggregatesFilter<"TextSegment"> | number
    startPosition?: IntWithAggregatesFilter<"TextSegment"> | number
    endPosition?: IntWithAggregatesFilter<"TextSegment"> | number
    content?: StringWithAggregatesFilter<"TextSegment"> | string
    wordCount?: IntNullableWithAggregatesFilter<"TextSegment"> | number | null
    segmentType?: StringNullableWithAggregatesFilter<"TextSegment"> | string | null
    orderIndex?: IntWithAggregatesFilter<"TextSegment"> | number
    metadata?: JsonNullableWithAggregatesFilter<"TextSegment">
    status?: StringWithAggregatesFilter<"TextSegment"> | string
    createdAt?: DateTimeWithAggregatesFilter<"TextSegment"> | Date | string
  }

  export type ScriptSentenceWhereInput = {
    AND?: ScriptSentenceWhereInput | ScriptSentenceWhereInput[]
    OR?: ScriptSentenceWhereInput[]
    NOT?: ScriptSentenceWhereInput | ScriptSentenceWhereInput[]
    id?: StringFilter<"ScriptSentence"> | string
    bookId?: StringFilter<"ScriptSentence"> | string
    segmentId?: StringFilter<"ScriptSentence"> | string
    characterId?: StringNullableFilter<"ScriptSentence"> | string | null
    rawSpeaker?: StringNullableFilter<"ScriptSentence"> | string | null
    text?: StringFilter<"ScriptSentence"> | string
    orderInSegment?: IntFilter<"ScriptSentence"> | number
    tone?: StringNullableFilter<"ScriptSentence"> | string | null
    strength?: IntNullableFilter<"ScriptSentence"> | number | null
    pauseAfter?: DecimalNullableFilter<"ScriptSentence"> | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: JsonNullableFilter<"ScriptSentence">
    createdAt?: DateTimeFilter<"ScriptSentence"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    character?: XOR<CharacterProfileNullableScalarRelationFilter, CharacterProfileWhereInput> | null
    segment?: XOR<TextSegmentScalarRelationFilter, TextSegmentWhereInput>
  }

  export type ScriptSentenceOrderByWithRelationInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentId?: SortOrder
    characterId?: SortOrderInput | SortOrder
    rawSpeaker?: SortOrderInput | SortOrder
    text?: SortOrder
    orderInSegment?: SortOrder
    tone?: SortOrderInput | SortOrder
    strength?: SortOrderInput | SortOrder
    pauseAfter?: SortOrderInput | SortOrder
    ttsParameters?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    audioFiles?: AudioFileOrderByRelationAggregateInput
    book?: BookOrderByWithRelationInput
    character?: CharacterProfileOrderByWithRelationInput
    segment?: TextSegmentOrderByWithRelationInput
  }

  export type ScriptSentenceWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ScriptSentenceWhereInput | ScriptSentenceWhereInput[]
    OR?: ScriptSentenceWhereInput[]
    NOT?: ScriptSentenceWhereInput | ScriptSentenceWhereInput[]
    bookId?: StringFilter<"ScriptSentence"> | string
    segmentId?: StringFilter<"ScriptSentence"> | string
    characterId?: StringNullableFilter<"ScriptSentence"> | string | null
    rawSpeaker?: StringNullableFilter<"ScriptSentence"> | string | null
    text?: StringFilter<"ScriptSentence"> | string
    orderInSegment?: IntFilter<"ScriptSentence"> | number
    tone?: StringNullableFilter<"ScriptSentence"> | string | null
    strength?: IntNullableFilter<"ScriptSentence"> | number | null
    pauseAfter?: DecimalNullableFilter<"ScriptSentence"> | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: JsonNullableFilter<"ScriptSentence">
    createdAt?: DateTimeFilter<"ScriptSentence"> | Date | string
    audioFiles?: AudioFileListRelationFilter
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    character?: XOR<CharacterProfileNullableScalarRelationFilter, CharacterProfileWhereInput> | null
    segment?: XOR<TextSegmentScalarRelationFilter, TextSegmentWhereInput>
  }, "id">

  export type ScriptSentenceOrderByWithAggregationInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentId?: SortOrder
    characterId?: SortOrderInput | SortOrder
    rawSpeaker?: SortOrderInput | SortOrder
    text?: SortOrder
    orderInSegment?: SortOrder
    tone?: SortOrderInput | SortOrder
    strength?: SortOrderInput | SortOrder
    pauseAfter?: SortOrderInput | SortOrder
    ttsParameters?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: ScriptSentenceCountOrderByAggregateInput
    _avg?: ScriptSentenceAvgOrderByAggregateInput
    _max?: ScriptSentenceMaxOrderByAggregateInput
    _min?: ScriptSentenceMinOrderByAggregateInput
    _sum?: ScriptSentenceSumOrderByAggregateInput
  }

  export type ScriptSentenceScalarWhereWithAggregatesInput = {
    AND?: ScriptSentenceScalarWhereWithAggregatesInput | ScriptSentenceScalarWhereWithAggregatesInput[]
    OR?: ScriptSentenceScalarWhereWithAggregatesInput[]
    NOT?: ScriptSentenceScalarWhereWithAggregatesInput | ScriptSentenceScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ScriptSentence"> | string
    bookId?: StringWithAggregatesFilter<"ScriptSentence"> | string
    segmentId?: StringWithAggregatesFilter<"ScriptSentence"> | string
    characterId?: StringNullableWithAggregatesFilter<"ScriptSentence"> | string | null
    rawSpeaker?: StringNullableWithAggregatesFilter<"ScriptSentence"> | string | null
    text?: StringWithAggregatesFilter<"ScriptSentence"> | string
    orderInSegment?: IntWithAggregatesFilter<"ScriptSentence"> | number
    tone?: StringNullableWithAggregatesFilter<"ScriptSentence"> | string | null
    strength?: IntNullableWithAggregatesFilter<"ScriptSentence"> | number | null
    pauseAfter?: DecimalNullableWithAggregatesFilter<"ScriptSentence"> | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: JsonNullableWithAggregatesFilter<"ScriptSentence">
    createdAt?: DateTimeWithAggregatesFilter<"ScriptSentence"> | Date | string
  }

  export type AudioFileWhereInput = {
    AND?: AudioFileWhereInput | AudioFileWhereInput[]
    OR?: AudioFileWhereInput[]
    NOT?: AudioFileWhereInput | AudioFileWhereInput[]
    id?: StringFilter<"AudioFile"> | string
    bookId?: StringFilter<"AudioFile"> | string
    sentenceId?: StringNullableFilter<"AudioFile"> | string | null
    segmentId?: StringNullableFilter<"AudioFile"> | string | null
    filePath?: StringFilter<"AudioFile"> | string
    fileName?: StringNullableFilter<"AudioFile"> | string | null
    duration?: DecimalNullableFilter<"AudioFile"> | Decimal | DecimalJsLike | number | string | null
    fileSize?: BigIntNullableFilter<"AudioFile"> | bigint | number | null
    format?: StringNullableFilter<"AudioFile"> | string | null
    status?: StringFilter<"AudioFile"> | string
    errorMessage?: StringNullableFilter<"AudioFile"> | string | null
    retryCount?: IntFilter<"AudioFile"> | number
    provider?: StringNullableFilter<"AudioFile"> | string | null
    voiceProfileId?: StringNullableFilter<"AudioFile"> | string | null
    createdAt?: DateTimeFilter<"AudioFile"> | Date | string
    updatedAt?: DateTimeFilter<"AudioFile"> | Date | string
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    segment?: XOR<TextSegmentNullableScalarRelationFilter, TextSegmentWhereInput> | null
    scriptSentence?: XOR<ScriptSentenceNullableScalarRelationFilter, ScriptSentenceWhereInput> | null
    voiceProfile?: XOR<TTSVoiceProfileNullableScalarRelationFilter, TTSVoiceProfileWhereInput> | null
  }

  export type AudioFileOrderByWithRelationInput = {
    id?: SortOrder
    bookId?: SortOrder
    sentenceId?: SortOrderInput | SortOrder
    segmentId?: SortOrderInput | SortOrder
    filePath?: SortOrder
    fileName?: SortOrderInput | SortOrder
    duration?: SortOrderInput | SortOrder
    fileSize?: SortOrderInput | SortOrder
    format?: SortOrderInput | SortOrder
    status?: SortOrder
    errorMessage?: SortOrderInput | SortOrder
    retryCount?: SortOrder
    provider?: SortOrderInput | SortOrder
    voiceProfileId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    book?: BookOrderByWithRelationInput
    segment?: TextSegmentOrderByWithRelationInput
    scriptSentence?: ScriptSentenceOrderByWithRelationInput
    voiceProfile?: TTSVoiceProfileOrderByWithRelationInput
  }

  export type AudioFileWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AudioFileWhereInput | AudioFileWhereInput[]
    OR?: AudioFileWhereInput[]
    NOT?: AudioFileWhereInput | AudioFileWhereInput[]
    bookId?: StringFilter<"AudioFile"> | string
    sentenceId?: StringNullableFilter<"AudioFile"> | string | null
    segmentId?: StringNullableFilter<"AudioFile"> | string | null
    filePath?: StringFilter<"AudioFile"> | string
    fileName?: StringNullableFilter<"AudioFile"> | string | null
    duration?: DecimalNullableFilter<"AudioFile"> | Decimal | DecimalJsLike | number | string | null
    fileSize?: BigIntNullableFilter<"AudioFile"> | bigint | number | null
    format?: StringNullableFilter<"AudioFile"> | string | null
    status?: StringFilter<"AudioFile"> | string
    errorMessage?: StringNullableFilter<"AudioFile"> | string | null
    retryCount?: IntFilter<"AudioFile"> | number
    provider?: StringNullableFilter<"AudioFile"> | string | null
    voiceProfileId?: StringNullableFilter<"AudioFile"> | string | null
    createdAt?: DateTimeFilter<"AudioFile"> | Date | string
    updatedAt?: DateTimeFilter<"AudioFile"> | Date | string
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    segment?: XOR<TextSegmentNullableScalarRelationFilter, TextSegmentWhereInput> | null
    scriptSentence?: XOR<ScriptSentenceNullableScalarRelationFilter, ScriptSentenceWhereInput> | null
    voiceProfile?: XOR<TTSVoiceProfileNullableScalarRelationFilter, TTSVoiceProfileWhereInput> | null
  }, "id">

  export type AudioFileOrderByWithAggregationInput = {
    id?: SortOrder
    bookId?: SortOrder
    sentenceId?: SortOrderInput | SortOrder
    segmentId?: SortOrderInput | SortOrder
    filePath?: SortOrder
    fileName?: SortOrderInput | SortOrder
    duration?: SortOrderInput | SortOrder
    fileSize?: SortOrderInput | SortOrder
    format?: SortOrderInput | SortOrder
    status?: SortOrder
    errorMessage?: SortOrderInput | SortOrder
    retryCount?: SortOrder
    provider?: SortOrderInput | SortOrder
    voiceProfileId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AudioFileCountOrderByAggregateInput
    _avg?: AudioFileAvgOrderByAggregateInput
    _max?: AudioFileMaxOrderByAggregateInput
    _min?: AudioFileMinOrderByAggregateInput
    _sum?: AudioFileSumOrderByAggregateInput
  }

  export type AudioFileScalarWhereWithAggregatesInput = {
    AND?: AudioFileScalarWhereWithAggregatesInput | AudioFileScalarWhereWithAggregatesInput[]
    OR?: AudioFileScalarWhereWithAggregatesInput[]
    NOT?: AudioFileScalarWhereWithAggregatesInput | AudioFileScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"AudioFile"> | string
    bookId?: StringWithAggregatesFilter<"AudioFile"> | string
    sentenceId?: StringNullableWithAggregatesFilter<"AudioFile"> | string | null
    segmentId?: StringNullableWithAggregatesFilter<"AudioFile"> | string | null
    filePath?: StringWithAggregatesFilter<"AudioFile"> | string
    fileName?: StringNullableWithAggregatesFilter<"AudioFile"> | string | null
    duration?: DecimalNullableWithAggregatesFilter<"AudioFile"> | Decimal | DecimalJsLike | number | string | null
    fileSize?: BigIntNullableWithAggregatesFilter<"AudioFile"> | bigint | number | null
    format?: StringNullableWithAggregatesFilter<"AudioFile"> | string | null
    status?: StringWithAggregatesFilter<"AudioFile"> | string
    errorMessage?: StringNullableWithAggregatesFilter<"AudioFile"> | string | null
    retryCount?: IntWithAggregatesFilter<"AudioFile"> | number
    provider?: StringNullableWithAggregatesFilter<"AudioFile"> | string | null
    voiceProfileId?: StringNullableWithAggregatesFilter<"AudioFile"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"AudioFile"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"AudioFile"> | Date | string
  }

  export type CharacterMergeAuditWhereInput = {
    AND?: CharacterMergeAuditWhereInput | CharacterMergeAuditWhereInput[]
    OR?: CharacterMergeAuditWhereInput[]
    NOT?: CharacterMergeAuditWhereInput | CharacterMergeAuditWhereInput[]
    id?: StringFilter<"CharacterMergeAudit"> | string
    bookId?: StringFilter<"CharacterMergeAudit"> | string
    sourceCharacterId?: StringFilter<"CharacterMergeAudit"> | string
    targetCharacterId?: StringFilter<"CharacterMergeAudit"> | string
    mergeReason?: StringNullableFilter<"CharacterMergeAudit"> | string | null
    mergedBy?: StringNullableFilter<"CharacterMergeAudit"> | string | null
    createdAt?: DateTimeFilter<"CharacterMergeAudit"> | Date | string
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    sourceCharacter?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
    targetCharacter?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
  }

  export type CharacterMergeAuditOrderByWithRelationInput = {
    id?: SortOrder
    bookId?: SortOrder
    sourceCharacterId?: SortOrder
    targetCharacterId?: SortOrder
    mergeReason?: SortOrderInput | SortOrder
    mergedBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    book?: BookOrderByWithRelationInput
    sourceCharacter?: CharacterProfileOrderByWithRelationInput
    targetCharacter?: CharacterProfileOrderByWithRelationInput
  }

  export type CharacterMergeAuditWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: CharacterMergeAuditWhereInput | CharacterMergeAuditWhereInput[]
    OR?: CharacterMergeAuditWhereInput[]
    NOT?: CharacterMergeAuditWhereInput | CharacterMergeAuditWhereInput[]
    bookId?: StringFilter<"CharacterMergeAudit"> | string
    sourceCharacterId?: StringFilter<"CharacterMergeAudit"> | string
    targetCharacterId?: StringFilter<"CharacterMergeAudit"> | string
    mergeReason?: StringNullableFilter<"CharacterMergeAudit"> | string | null
    mergedBy?: StringNullableFilter<"CharacterMergeAudit"> | string | null
    createdAt?: DateTimeFilter<"CharacterMergeAudit"> | Date | string
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
    sourceCharacter?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
    targetCharacter?: XOR<CharacterProfileScalarRelationFilter, CharacterProfileWhereInput>
  }, "id">

  export type CharacterMergeAuditOrderByWithAggregationInput = {
    id?: SortOrder
    bookId?: SortOrder
    sourceCharacterId?: SortOrder
    targetCharacterId?: SortOrder
    mergeReason?: SortOrderInput | SortOrder
    mergedBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: CharacterMergeAuditCountOrderByAggregateInput
    _max?: CharacterMergeAuditMaxOrderByAggregateInput
    _min?: CharacterMergeAuditMinOrderByAggregateInput
  }

  export type CharacterMergeAuditScalarWhereWithAggregatesInput = {
    AND?: CharacterMergeAuditScalarWhereWithAggregatesInput | CharacterMergeAuditScalarWhereWithAggregatesInput[]
    OR?: CharacterMergeAuditScalarWhereWithAggregatesInput[]
    NOT?: CharacterMergeAuditScalarWhereWithAggregatesInput | CharacterMergeAuditScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"CharacterMergeAudit"> | string
    bookId?: StringWithAggregatesFilter<"CharacterMergeAudit"> | string
    sourceCharacterId?: StringWithAggregatesFilter<"CharacterMergeAudit"> | string
    targetCharacterId?: StringWithAggregatesFilter<"CharacterMergeAudit"> | string
    mergeReason?: StringNullableWithAggregatesFilter<"CharacterMergeAudit"> | string | null
    mergedBy?: StringNullableWithAggregatesFilter<"CharacterMergeAudit"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"CharacterMergeAudit"> | Date | string
  }

  export type ProcessingTaskWhereInput = {
    AND?: ProcessingTaskWhereInput | ProcessingTaskWhereInput[]
    OR?: ProcessingTaskWhereInput[]
    NOT?: ProcessingTaskWhereInput | ProcessingTaskWhereInput[]
    id?: StringFilter<"ProcessingTask"> | string
    bookId?: StringFilter<"ProcessingTask"> | string
    taskType?: StringFilter<"ProcessingTask"> | string
    status?: StringFilter<"ProcessingTask"> | string
    progress?: IntFilter<"ProcessingTask"> | number
    totalItems?: IntFilter<"ProcessingTask"> | number
    processedItems?: IntFilter<"ProcessingTask"> | number
    taskData?: JsonFilter<"ProcessingTask">
    errorMessage?: StringNullableFilter<"ProcessingTask"> | string | null
    externalTaskId?: StringNullableFilter<"ProcessingTask"> | string | null
    startedAt?: DateTimeNullableFilter<"ProcessingTask"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"ProcessingTask"> | Date | string | null
    createdAt?: DateTimeFilter<"ProcessingTask"> | Date | string
    updatedAt?: DateTimeFilter<"ProcessingTask"> | Date | string
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
  }

  export type ProcessingTaskOrderByWithRelationInput = {
    id?: SortOrder
    bookId?: SortOrder
    taskType?: SortOrder
    status?: SortOrder
    progress?: SortOrder
    totalItems?: SortOrder
    processedItems?: SortOrder
    taskData?: SortOrder
    errorMessage?: SortOrderInput | SortOrder
    externalTaskId?: SortOrderInput | SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    book?: BookOrderByWithRelationInput
  }

  export type ProcessingTaskWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ProcessingTaskWhereInput | ProcessingTaskWhereInput[]
    OR?: ProcessingTaskWhereInput[]
    NOT?: ProcessingTaskWhereInput | ProcessingTaskWhereInput[]
    bookId?: StringFilter<"ProcessingTask"> | string
    taskType?: StringFilter<"ProcessingTask"> | string
    status?: StringFilter<"ProcessingTask"> | string
    progress?: IntFilter<"ProcessingTask"> | number
    totalItems?: IntFilter<"ProcessingTask"> | number
    processedItems?: IntFilter<"ProcessingTask"> | number
    taskData?: JsonFilter<"ProcessingTask">
    errorMessage?: StringNullableFilter<"ProcessingTask"> | string | null
    externalTaskId?: StringNullableFilter<"ProcessingTask"> | string | null
    startedAt?: DateTimeNullableFilter<"ProcessingTask"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"ProcessingTask"> | Date | string | null
    createdAt?: DateTimeFilter<"ProcessingTask"> | Date | string
    updatedAt?: DateTimeFilter<"ProcessingTask"> | Date | string
    book?: XOR<BookScalarRelationFilter, BookWhereInput>
  }, "id">

  export type ProcessingTaskOrderByWithAggregationInput = {
    id?: SortOrder
    bookId?: SortOrder
    taskType?: SortOrder
    status?: SortOrder
    progress?: SortOrder
    totalItems?: SortOrder
    processedItems?: SortOrder
    taskData?: SortOrder
    errorMessage?: SortOrderInput | SortOrder
    externalTaskId?: SortOrderInput | SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ProcessingTaskCountOrderByAggregateInput
    _avg?: ProcessingTaskAvgOrderByAggregateInput
    _max?: ProcessingTaskMaxOrderByAggregateInput
    _min?: ProcessingTaskMinOrderByAggregateInput
    _sum?: ProcessingTaskSumOrderByAggregateInput
  }

  export type ProcessingTaskScalarWhereWithAggregatesInput = {
    AND?: ProcessingTaskScalarWhereWithAggregatesInput | ProcessingTaskScalarWhereWithAggregatesInput[]
    OR?: ProcessingTaskScalarWhereWithAggregatesInput[]
    NOT?: ProcessingTaskScalarWhereWithAggregatesInput | ProcessingTaskScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ProcessingTask"> | string
    bookId?: StringWithAggregatesFilter<"ProcessingTask"> | string
    taskType?: StringWithAggregatesFilter<"ProcessingTask"> | string
    status?: StringWithAggregatesFilter<"ProcessingTask"> | string
    progress?: IntWithAggregatesFilter<"ProcessingTask"> | number
    totalItems?: IntWithAggregatesFilter<"ProcessingTask"> | number
    processedItems?: IntWithAggregatesFilter<"ProcessingTask"> | number
    taskData?: JsonWithAggregatesFilter<"ProcessingTask">
    errorMessage?: StringNullableWithAggregatesFilter<"ProcessingTask"> | string | null
    externalTaskId?: StringNullableWithAggregatesFilter<"ProcessingTask"> | string | null
    startedAt?: DateTimeNullableWithAggregatesFilter<"ProcessingTask"> | Date | string | null
    completedAt?: DateTimeNullableWithAggregatesFilter<"ProcessingTask"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ProcessingTask"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ProcessingTask"> | Date | string
  }

  export type BookCreateInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentCreateNestedManyWithoutBookInput
  }

  export type BookUncheckedCreateInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditUncheckedCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileUncheckedCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskUncheckedCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentUncheckedCreateNestedManyWithoutBookInput
  }

  export type BookUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUpdateManyWithoutBookNestedInput
  }

  export type BookUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUncheckedUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUncheckedUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUncheckedUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUncheckedUpdateManyWithoutBookNestedInput
  }

  export type BookCreateManyInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BookUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BookUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterProfileCreateInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditCreateNestedManyWithoutTargetCharacterInput
    book: BookCreateNestedOneWithoutCharacterProfilesInput
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUncheckedCreateInput = {
    id?: string
    bookId: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasUncheckedCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedCreateNestedManyWithoutTargetCharacterInput
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUpdateManyWithoutTargetCharacterNestedInput
    book?: BookUpdateOneRequiredWithoutCharacterProfilesNestedInput
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUncheckedUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterNestedInput
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileCreateManyInput = {
    id?: string
    bookId: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CharacterProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterAliasCreateInput = {
    id?: string
    alias: string
    confidence?: Decimal | DecimalJsLike | number | string
    sourceSentence?: string | null
    createdAt?: Date | string
    character: CharacterProfileCreateNestedOneWithoutAliasesInput
  }

  export type CharacterAliasUncheckedCreateInput = {
    id?: string
    characterId: string
    alias: string
    confidence?: Decimal | DecimalJsLike | number | string
    sourceSentence?: string | null
    createdAt?: Date | string
  }

  export type CharacterAliasUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    alias?: StringFieldUpdateOperationsInput | string
    confidence?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sourceSentence?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    character?: CharacterProfileUpdateOneRequiredWithoutAliasesNestedInput
  }

  export type CharacterAliasUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    characterId?: StringFieldUpdateOperationsInput | string
    alias?: StringFieldUpdateOperationsInput | string
    confidence?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sourceSentence?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterAliasCreateManyInput = {
    id?: string
    characterId: string
    alias: string
    confidence?: Decimal | DecimalJsLike | number | string
    sourceSentence?: string | null
    createdAt?: Date | string
  }

  export type CharacterAliasUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    alias?: StringFieldUpdateOperationsInput | string
    confidence?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sourceSentence?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterAliasUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    characterId?: StringFieldUpdateOperationsInput | string
    alias?: StringFieldUpdateOperationsInput | string
    confidence?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sourceSentence?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TTSVoiceProfileCreateInput = {
    id?: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description?: string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: number
    rating?: Decimal | DecimalJsLike | number | string
    isAvailable?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutVoiceProfileInput
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutVoiceProfileInput
  }

  export type TTSVoiceProfileUncheckedCreateInput = {
    id?: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description?: string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: number
    rating?: Decimal | DecimalJsLike | number | string
    isAvailable?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutVoiceProfileInput
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutVoiceProfileInput
  }

  export type TTSVoiceProfileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutVoiceProfileNestedInput
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutVoiceProfileNestedInput
  }

  export type TTSVoiceProfileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutVoiceProfileNestedInput
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutVoiceProfileNestedInput
  }

  export type TTSVoiceProfileCreateManyInput = {
    id?: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description?: string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: number
    rating?: Decimal | DecimalJsLike | number | string
    isAvailable?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TTSVoiceProfileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TTSVoiceProfileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterVoiceBindingCreateInput = {
    id?: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    character: CharacterProfileCreateNestedOneWithoutVoiceBindingsInput
    voiceProfile: TTSVoiceProfileCreateNestedOneWithoutVoiceBindingsInput
  }

  export type CharacterVoiceBindingUncheckedCreateInput = {
    id?: string
    characterId: string
    voiceProfileId: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CharacterVoiceBindingUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    character?: CharacterProfileUpdateOneRequiredWithoutVoiceBindingsNestedInput
    voiceProfile?: TTSVoiceProfileUpdateOneRequiredWithoutVoiceBindingsNestedInput
  }

  export type CharacterVoiceBindingUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    characterId?: StringFieldUpdateOperationsInput | string
    voiceProfileId?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterVoiceBindingCreateManyInput = {
    id?: string
    characterId: string
    voiceProfileId: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CharacterVoiceBindingUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterVoiceBindingUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    characterId?: StringFieldUpdateOperationsInput | string
    voiceProfileId?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TextSegmentCreateInput = {
    id?: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutSegmentInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutSegmentInput
    book: BookCreateNestedOneWithoutTextSegmentsInput
  }

  export type TextSegmentUncheckedCreateInput = {
    id?: string
    bookId: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutSegmentInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutSegmentInput
  }

  export type TextSegmentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutSegmentNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutSegmentNestedInput
    book?: BookUpdateOneRequiredWithoutTextSegmentsNestedInput
  }

  export type TextSegmentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutSegmentNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutSegmentNestedInput
  }

  export type TextSegmentCreateManyInput = {
    id?: string
    bookId: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
  }

  export type TextSegmentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TextSegmentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ScriptSentenceCreateInput = {
    id?: string
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutScriptSentenceInput
    book: BookCreateNestedOneWithoutScriptSentencesInput
    character?: CharacterProfileCreateNestedOneWithoutScriptSentencesInput
    segment: TextSegmentCreateNestedOneWithoutScriptSentencesInput
  }

  export type ScriptSentenceUncheckedCreateInput = {
    id?: string
    bookId: string
    segmentId: string
    characterId?: string | null
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutScriptSentenceInput
  }

  export type ScriptSentenceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutScriptSentenceNestedInput
    book?: BookUpdateOneRequiredWithoutScriptSentencesNestedInput
    character?: CharacterProfileUpdateOneWithoutScriptSentencesNestedInput
    segment?: TextSegmentUpdateOneRequiredWithoutScriptSentencesNestedInput
  }

  export type ScriptSentenceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentId?: StringFieldUpdateOperationsInput | string
    characterId?: NullableStringFieldUpdateOperationsInput | string | null
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutScriptSentenceNestedInput
  }

  export type ScriptSentenceCreateManyInput = {
    id?: string
    bookId: string
    segmentId: string
    characterId?: string | null
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type ScriptSentenceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ScriptSentenceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentId?: StringFieldUpdateOperationsInput | string
    characterId?: NullableStringFieldUpdateOperationsInput | string | null
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileCreateInput = {
    id?: string
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    book: BookCreateNestedOneWithoutAudioFilesInput
    segment?: TextSegmentCreateNestedOneWithoutAudioFilesInput
    scriptSentence?: ScriptSentenceCreateNestedOneWithoutAudioFilesInput
    voiceProfile?: TTSVoiceProfileCreateNestedOneWithoutAudioFilesInput
  }

  export type AudioFileUncheckedCreateInput = {
    id?: string
    bookId: string
    sentenceId?: string | null
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutAudioFilesNestedInput
    segment?: TextSegmentUpdateOneWithoutAudioFilesNestedInput
    scriptSentence?: ScriptSentenceUpdateOneWithoutAudioFilesNestedInput
    voiceProfile?: TTSVoiceProfileUpdateOneWithoutAudioFilesNestedInput
  }

  export type AudioFileUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileCreateManyInput = {
    id?: string
    bookId: string
    sentenceId?: string | null
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditCreateInput = {
    id?: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
    book: BookCreateNestedOneWithoutMergeAuditsInput
    sourceCharacter: CharacterProfileCreateNestedOneWithoutMergeAuditsSourceInput
    targetCharacter: CharacterProfileCreateNestedOneWithoutMergeAuditsTargetInput
  }

  export type CharacterMergeAuditUncheckedCreateInput = {
    id?: string
    bookId: string
    sourceCharacterId: string
    targetCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterMergeAuditUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutMergeAuditsNestedInput
    sourceCharacter?: CharacterProfileUpdateOneRequiredWithoutMergeAuditsSourceNestedInput
    targetCharacter?: CharacterProfileUpdateOneRequiredWithoutMergeAuditsTargetNestedInput
  }

  export type CharacterMergeAuditUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sourceCharacterId?: StringFieldUpdateOperationsInput | string
    targetCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditCreateManyInput = {
    id?: string
    bookId: string
    sourceCharacterId: string
    targetCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterMergeAuditUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sourceCharacterId?: StringFieldUpdateOperationsInput | string
    targetCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProcessingTaskCreateInput = {
    id?: string
    taskType: string
    status?: string
    progress?: number
    totalItems?: number
    processedItems?: number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: string | null
    externalTaskId?: string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    book: BookCreateNestedOneWithoutProcessingTasksInput
  }

  export type ProcessingTaskUncheckedCreateInput = {
    id?: string
    bookId: string
    taskType: string
    status?: string
    progress?: number
    totalItems?: number
    processedItems?: number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: string | null
    externalTaskId?: string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProcessingTaskUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    taskType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    progress?: IntFieldUpdateOperationsInput | number
    totalItems?: IntFieldUpdateOperationsInput | number
    processedItems?: IntFieldUpdateOperationsInput | number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    externalTaskId?: NullableStringFieldUpdateOperationsInput | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutProcessingTasksNestedInput
  }

  export type ProcessingTaskUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    taskType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    progress?: IntFieldUpdateOperationsInput | number
    totalItems?: IntFieldUpdateOperationsInput | number
    processedItems?: IntFieldUpdateOperationsInput | number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    externalTaskId?: NullableStringFieldUpdateOperationsInput | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProcessingTaskCreateManyInput = {
    id?: string
    bookId: string
    taskType: string
    status?: string
    progress?: number
    totalItems?: number
    processedItems?: number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: string | null
    externalTaskId?: string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProcessingTaskUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    taskType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    progress?: IntFieldUpdateOperationsInput | number
    totalItems?: IntFieldUpdateOperationsInput | number
    processedItems?: IntFieldUpdateOperationsInput | number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    externalTaskId?: NullableStringFieldUpdateOperationsInput | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProcessingTaskUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    taskType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    progress?: IntFieldUpdateOperationsInput | number
    totalItems?: IntFieldUpdateOperationsInput | number
    processedItems?: IntFieldUpdateOperationsInput | number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    externalTaskId?: NullableStringFieldUpdateOperationsInput | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type BigIntNullableFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableFilter<$PrismaModel> | bigint | number | null
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type AudioFileListRelationFilter = {
    every?: AudioFileWhereInput
    some?: AudioFileWhereInput
    none?: AudioFileWhereInput
  }

  export type CharacterMergeAuditListRelationFilter = {
    every?: CharacterMergeAuditWhereInput
    some?: CharacterMergeAuditWhereInput
    none?: CharacterMergeAuditWhereInput
  }

  export type CharacterProfileListRelationFilter = {
    every?: CharacterProfileWhereInput
    some?: CharacterProfileWhereInput
    none?: CharacterProfileWhereInput
  }

  export type ProcessingTaskListRelationFilter = {
    every?: ProcessingTaskWhereInput
    some?: ProcessingTaskWhereInput
    none?: ProcessingTaskWhereInput
  }

  export type ScriptSentenceListRelationFilter = {
    every?: ScriptSentenceWhereInput
    some?: ScriptSentenceWhereInput
    none?: ScriptSentenceWhereInput
  }

  export type TextSegmentListRelationFilter = {
    every?: TextSegmentWhereInput
    some?: TextSegmentWhereInput
    none?: TextSegmentWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type AudioFileOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CharacterMergeAuditOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CharacterProfileOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ProcessingTaskOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ScriptSentenceOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TextSegmentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type BookCountOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    author?: SortOrder
    originalFilename?: SortOrder
    uploadedFilePath?: SortOrder
    fileSize?: SortOrder
    totalWords?: SortOrder
    totalCharacters?: SortOrder
    totalSegments?: SortOrder
    encoding?: SortOrder
    fileFormat?: SortOrder
    status?: SortOrder
    metadata?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BookAvgOrderByAggregateInput = {
    fileSize?: SortOrder
    totalWords?: SortOrder
    totalCharacters?: SortOrder
    totalSegments?: SortOrder
  }

  export type BookMaxOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    author?: SortOrder
    originalFilename?: SortOrder
    uploadedFilePath?: SortOrder
    fileSize?: SortOrder
    totalWords?: SortOrder
    totalCharacters?: SortOrder
    totalSegments?: SortOrder
    encoding?: SortOrder
    fileFormat?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BookMinOrderByAggregateInput = {
    id?: SortOrder
    title?: SortOrder
    author?: SortOrder
    originalFilename?: SortOrder
    uploadedFilePath?: SortOrder
    fileSize?: SortOrder
    totalWords?: SortOrder
    totalCharacters?: SortOrder
    totalSegments?: SortOrder
    encoding?: SortOrder
    fileFormat?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BookSumOrderByAggregateInput = {
    fileSize?: SortOrder
    totalWords?: SortOrder
    totalCharacters?: SortOrder
    totalSegments?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type BigIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableWithAggregatesFilter<$PrismaModel> | bigint | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedBigIntNullableFilter<$PrismaModel>
    _min?: NestedBigIntNullableFilter<$PrismaModel>
    _max?: NestedBigIntNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type CharacterAliasListRelationFilter = {
    every?: CharacterAliasWhereInput
    some?: CharacterAliasWhereInput
    none?: CharacterAliasWhereInput
  }

  export type BookScalarRelationFilter = {
    is?: BookWhereInput
    isNot?: BookWhereInput
  }

  export type CharacterVoiceBindingListRelationFilter = {
    every?: CharacterVoiceBindingWhereInput
    some?: CharacterVoiceBindingWhereInput
    none?: CharacterVoiceBindingWhereInput
  }

  export type CharacterAliasOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CharacterVoiceBindingOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CharacterProfileCountOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    canonicalName?: SortOrder
    characteristics?: SortOrder
    voicePreferences?: SortOrder
    emotionProfile?: SortOrder
    genderHint?: SortOrder
    ageHint?: SortOrder
    emotionBaseline?: SortOrder
    isActive?: SortOrder
    mentions?: SortOrder
    quotes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CharacterProfileAvgOrderByAggregateInput = {
    ageHint?: SortOrder
    mentions?: SortOrder
    quotes?: SortOrder
  }

  export type CharacterProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    canonicalName?: SortOrder
    genderHint?: SortOrder
    ageHint?: SortOrder
    emotionBaseline?: SortOrder
    isActive?: SortOrder
    mentions?: SortOrder
    quotes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CharacterProfileMinOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    canonicalName?: SortOrder
    genderHint?: SortOrder
    ageHint?: SortOrder
    emotionBaseline?: SortOrder
    isActive?: SortOrder
    mentions?: SortOrder
    quotes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CharacterProfileSumOrderByAggregateInput = {
    ageHint?: SortOrder
    mentions?: SortOrder
    quotes?: SortOrder
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type CharacterProfileScalarRelationFilter = {
    is?: CharacterProfileWhereInput
    isNot?: CharacterProfileWhereInput
  }

  export type CharacterAliasCountOrderByAggregateInput = {
    id?: SortOrder
    characterId?: SortOrder
    alias?: SortOrder
    confidence?: SortOrder
    sourceSentence?: SortOrder
    createdAt?: SortOrder
  }

  export type CharacterAliasAvgOrderByAggregateInput = {
    confidence?: SortOrder
  }

  export type CharacterAliasMaxOrderByAggregateInput = {
    id?: SortOrder
    characterId?: SortOrder
    alias?: SortOrder
    confidence?: SortOrder
    sourceSentence?: SortOrder
    createdAt?: SortOrder
  }

  export type CharacterAliasMinOrderByAggregateInput = {
    id?: SortOrder
    characterId?: SortOrder
    alias?: SortOrder
    confidence?: SortOrder
    sourceSentence?: SortOrder
    createdAt?: SortOrder
  }

  export type CharacterAliasSumOrderByAggregateInput = {
    confidence?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type TTSVoiceProfileCountOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    voiceId?: SortOrder
    voiceName?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    characteristics?: SortOrder
    defaultParameters?: SortOrder
    previewAudio?: SortOrder
    usageCount?: SortOrder
    rating?: SortOrder
    isAvailable?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TTSVoiceProfileAvgOrderByAggregateInput = {
    usageCount?: SortOrder
    rating?: SortOrder
  }

  export type TTSVoiceProfileMaxOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    voiceId?: SortOrder
    voiceName?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    usageCount?: SortOrder
    rating?: SortOrder
    isAvailable?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TTSVoiceProfileMinOrderByAggregateInput = {
    id?: SortOrder
    provider?: SortOrder
    voiceId?: SortOrder
    voiceName?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    usageCount?: SortOrder
    rating?: SortOrder
    isAvailable?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TTSVoiceProfileSumOrderByAggregateInput = {
    usageCount?: SortOrder
    rating?: SortOrder
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type TTSVoiceProfileScalarRelationFilter = {
    is?: TTSVoiceProfileWhereInput
    isNot?: TTSVoiceProfileWhereInput
  }

  export type CharacterVoiceBindingCharacterIdVoiceProfileIdCompoundUniqueInput = {
    characterId: string
    voiceProfileId: string
  }

  export type CharacterVoiceBindingCountOrderByAggregateInput = {
    id?: SortOrder
    characterId?: SortOrder
    voiceProfileId?: SortOrder
    customParameters?: SortOrder
    emotionMappings?: SortOrder
    isDefault?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CharacterVoiceBindingMaxOrderByAggregateInput = {
    id?: SortOrder
    characterId?: SortOrder
    voiceProfileId?: SortOrder
    isDefault?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CharacterVoiceBindingMinOrderByAggregateInput = {
    id?: SortOrder
    characterId?: SortOrder
    voiceProfileId?: SortOrder
    isDefault?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TextSegmentCountOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentIndex?: SortOrder
    startPosition?: SortOrder
    endPosition?: SortOrder
    content?: SortOrder
    wordCount?: SortOrder
    segmentType?: SortOrder
    orderIndex?: SortOrder
    metadata?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
  }

  export type TextSegmentAvgOrderByAggregateInput = {
    segmentIndex?: SortOrder
    startPosition?: SortOrder
    endPosition?: SortOrder
    wordCount?: SortOrder
    orderIndex?: SortOrder
  }

  export type TextSegmentMaxOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentIndex?: SortOrder
    startPosition?: SortOrder
    endPosition?: SortOrder
    content?: SortOrder
    wordCount?: SortOrder
    segmentType?: SortOrder
    orderIndex?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
  }

  export type TextSegmentMinOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentIndex?: SortOrder
    startPosition?: SortOrder
    endPosition?: SortOrder
    content?: SortOrder
    wordCount?: SortOrder
    segmentType?: SortOrder
    orderIndex?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
  }

  export type TextSegmentSumOrderByAggregateInput = {
    segmentIndex?: SortOrder
    startPosition?: SortOrder
    endPosition?: SortOrder
    wordCount?: SortOrder
    orderIndex?: SortOrder
  }

  export type DecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type CharacterProfileNullableScalarRelationFilter = {
    is?: CharacterProfileWhereInput | null
    isNot?: CharacterProfileWhereInput | null
  }

  export type TextSegmentScalarRelationFilter = {
    is?: TextSegmentWhereInput
    isNot?: TextSegmentWhereInput
  }

  export type ScriptSentenceCountOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentId?: SortOrder
    characterId?: SortOrder
    rawSpeaker?: SortOrder
    text?: SortOrder
    orderInSegment?: SortOrder
    tone?: SortOrder
    strength?: SortOrder
    pauseAfter?: SortOrder
    ttsParameters?: SortOrder
    createdAt?: SortOrder
  }

  export type ScriptSentenceAvgOrderByAggregateInput = {
    orderInSegment?: SortOrder
    strength?: SortOrder
    pauseAfter?: SortOrder
  }

  export type ScriptSentenceMaxOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentId?: SortOrder
    characterId?: SortOrder
    rawSpeaker?: SortOrder
    text?: SortOrder
    orderInSegment?: SortOrder
    tone?: SortOrder
    strength?: SortOrder
    pauseAfter?: SortOrder
    createdAt?: SortOrder
  }

  export type ScriptSentenceMinOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    segmentId?: SortOrder
    characterId?: SortOrder
    rawSpeaker?: SortOrder
    text?: SortOrder
    orderInSegment?: SortOrder
    tone?: SortOrder
    strength?: SortOrder
    pauseAfter?: SortOrder
    createdAt?: SortOrder
  }

  export type ScriptSentenceSumOrderByAggregateInput = {
    orderInSegment?: SortOrder
    strength?: SortOrder
    pauseAfter?: SortOrder
  }

  export type DecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type TextSegmentNullableScalarRelationFilter = {
    is?: TextSegmentWhereInput | null
    isNot?: TextSegmentWhereInput | null
  }

  export type ScriptSentenceNullableScalarRelationFilter = {
    is?: ScriptSentenceWhereInput | null
    isNot?: ScriptSentenceWhereInput | null
  }

  export type TTSVoiceProfileNullableScalarRelationFilter = {
    is?: TTSVoiceProfileWhereInput | null
    isNot?: TTSVoiceProfileWhereInput | null
  }

  export type AudioFileCountOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    sentenceId?: SortOrder
    segmentId?: SortOrder
    filePath?: SortOrder
    fileName?: SortOrder
    duration?: SortOrder
    fileSize?: SortOrder
    format?: SortOrder
    status?: SortOrder
    errorMessage?: SortOrder
    retryCount?: SortOrder
    provider?: SortOrder
    voiceProfileId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AudioFileAvgOrderByAggregateInput = {
    duration?: SortOrder
    fileSize?: SortOrder
    retryCount?: SortOrder
  }

  export type AudioFileMaxOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    sentenceId?: SortOrder
    segmentId?: SortOrder
    filePath?: SortOrder
    fileName?: SortOrder
    duration?: SortOrder
    fileSize?: SortOrder
    format?: SortOrder
    status?: SortOrder
    errorMessage?: SortOrder
    retryCount?: SortOrder
    provider?: SortOrder
    voiceProfileId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AudioFileMinOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    sentenceId?: SortOrder
    segmentId?: SortOrder
    filePath?: SortOrder
    fileName?: SortOrder
    duration?: SortOrder
    fileSize?: SortOrder
    format?: SortOrder
    status?: SortOrder
    errorMessage?: SortOrder
    retryCount?: SortOrder
    provider?: SortOrder
    voiceProfileId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AudioFileSumOrderByAggregateInput = {
    duration?: SortOrder
    fileSize?: SortOrder
    retryCount?: SortOrder
  }

  export type CharacterMergeAuditCountOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    sourceCharacterId?: SortOrder
    targetCharacterId?: SortOrder
    mergeReason?: SortOrder
    mergedBy?: SortOrder
    createdAt?: SortOrder
  }

  export type CharacterMergeAuditMaxOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    sourceCharacterId?: SortOrder
    targetCharacterId?: SortOrder
    mergeReason?: SortOrder
    mergedBy?: SortOrder
    createdAt?: SortOrder
  }

  export type CharacterMergeAuditMinOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    sourceCharacterId?: SortOrder
    targetCharacterId?: SortOrder
    mergeReason?: SortOrder
    mergedBy?: SortOrder
    createdAt?: SortOrder
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type ProcessingTaskCountOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    taskType?: SortOrder
    status?: SortOrder
    progress?: SortOrder
    totalItems?: SortOrder
    processedItems?: SortOrder
    taskData?: SortOrder
    errorMessage?: SortOrder
    externalTaskId?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProcessingTaskAvgOrderByAggregateInput = {
    progress?: SortOrder
    totalItems?: SortOrder
    processedItems?: SortOrder
  }

  export type ProcessingTaskMaxOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    taskType?: SortOrder
    status?: SortOrder
    progress?: SortOrder
    totalItems?: SortOrder
    processedItems?: SortOrder
    errorMessage?: SortOrder
    externalTaskId?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProcessingTaskMinOrderByAggregateInput = {
    id?: SortOrder
    bookId?: SortOrder
    taskType?: SortOrder
    status?: SortOrder
    progress?: SortOrder
    totalItems?: SortOrder
    processedItems?: SortOrder
    errorMessage?: SortOrder
    externalTaskId?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ProcessingTaskSumOrderByAggregateInput = {
    progress?: SortOrder
    totalItems?: SortOrder
    processedItems?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type AudioFileCreateNestedManyWithoutBookInput = {
    create?: XOR<AudioFileCreateWithoutBookInput, AudioFileUncheckedCreateWithoutBookInput> | AudioFileCreateWithoutBookInput[] | AudioFileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutBookInput | AudioFileCreateOrConnectWithoutBookInput[]
    createMany?: AudioFileCreateManyBookInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type CharacterMergeAuditCreateNestedManyWithoutBookInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutBookInput, CharacterMergeAuditUncheckedCreateWithoutBookInput> | CharacterMergeAuditCreateWithoutBookInput[] | CharacterMergeAuditUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutBookInput | CharacterMergeAuditCreateOrConnectWithoutBookInput[]
    createMany?: CharacterMergeAuditCreateManyBookInputEnvelope
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
  }

  export type CharacterProfileCreateNestedManyWithoutBookInput = {
    create?: XOR<CharacterProfileCreateWithoutBookInput, CharacterProfileUncheckedCreateWithoutBookInput> | CharacterProfileCreateWithoutBookInput[] | CharacterProfileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutBookInput | CharacterProfileCreateOrConnectWithoutBookInput[]
    createMany?: CharacterProfileCreateManyBookInputEnvelope
    connect?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
  }

  export type ProcessingTaskCreateNestedManyWithoutBookInput = {
    create?: XOR<ProcessingTaskCreateWithoutBookInput, ProcessingTaskUncheckedCreateWithoutBookInput> | ProcessingTaskCreateWithoutBookInput[] | ProcessingTaskUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ProcessingTaskCreateOrConnectWithoutBookInput | ProcessingTaskCreateOrConnectWithoutBookInput[]
    createMany?: ProcessingTaskCreateManyBookInputEnvelope
    connect?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
  }

  export type ScriptSentenceCreateNestedManyWithoutBookInput = {
    create?: XOR<ScriptSentenceCreateWithoutBookInput, ScriptSentenceUncheckedCreateWithoutBookInput> | ScriptSentenceCreateWithoutBookInput[] | ScriptSentenceUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutBookInput | ScriptSentenceCreateOrConnectWithoutBookInput[]
    createMany?: ScriptSentenceCreateManyBookInputEnvelope
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
  }

  export type TextSegmentCreateNestedManyWithoutBookInput = {
    create?: XOR<TextSegmentCreateWithoutBookInput, TextSegmentUncheckedCreateWithoutBookInput> | TextSegmentCreateWithoutBookInput[] | TextSegmentUncheckedCreateWithoutBookInput[]
    connectOrCreate?: TextSegmentCreateOrConnectWithoutBookInput | TextSegmentCreateOrConnectWithoutBookInput[]
    createMany?: TextSegmentCreateManyBookInputEnvelope
    connect?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
  }

  export type AudioFileUncheckedCreateNestedManyWithoutBookInput = {
    create?: XOR<AudioFileCreateWithoutBookInput, AudioFileUncheckedCreateWithoutBookInput> | AudioFileCreateWithoutBookInput[] | AudioFileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutBookInput | AudioFileCreateOrConnectWithoutBookInput[]
    createMany?: AudioFileCreateManyBookInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type CharacterMergeAuditUncheckedCreateNestedManyWithoutBookInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutBookInput, CharacterMergeAuditUncheckedCreateWithoutBookInput> | CharacterMergeAuditCreateWithoutBookInput[] | CharacterMergeAuditUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutBookInput | CharacterMergeAuditCreateOrConnectWithoutBookInput[]
    createMany?: CharacterMergeAuditCreateManyBookInputEnvelope
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
  }

  export type CharacterProfileUncheckedCreateNestedManyWithoutBookInput = {
    create?: XOR<CharacterProfileCreateWithoutBookInput, CharacterProfileUncheckedCreateWithoutBookInput> | CharacterProfileCreateWithoutBookInput[] | CharacterProfileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutBookInput | CharacterProfileCreateOrConnectWithoutBookInput[]
    createMany?: CharacterProfileCreateManyBookInputEnvelope
    connect?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
  }

  export type ProcessingTaskUncheckedCreateNestedManyWithoutBookInput = {
    create?: XOR<ProcessingTaskCreateWithoutBookInput, ProcessingTaskUncheckedCreateWithoutBookInput> | ProcessingTaskCreateWithoutBookInput[] | ProcessingTaskUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ProcessingTaskCreateOrConnectWithoutBookInput | ProcessingTaskCreateOrConnectWithoutBookInput[]
    createMany?: ProcessingTaskCreateManyBookInputEnvelope
    connect?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
  }

  export type ScriptSentenceUncheckedCreateNestedManyWithoutBookInput = {
    create?: XOR<ScriptSentenceCreateWithoutBookInput, ScriptSentenceUncheckedCreateWithoutBookInput> | ScriptSentenceCreateWithoutBookInput[] | ScriptSentenceUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutBookInput | ScriptSentenceCreateOrConnectWithoutBookInput[]
    createMany?: ScriptSentenceCreateManyBookInputEnvelope
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
  }

  export type TextSegmentUncheckedCreateNestedManyWithoutBookInput = {
    create?: XOR<TextSegmentCreateWithoutBookInput, TextSegmentUncheckedCreateWithoutBookInput> | TextSegmentCreateWithoutBookInput[] | TextSegmentUncheckedCreateWithoutBookInput[]
    connectOrCreate?: TextSegmentCreateOrConnectWithoutBookInput | TextSegmentCreateOrConnectWithoutBookInput[]
    createMany?: TextSegmentCreateManyBookInputEnvelope
    connect?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NullableBigIntFieldUpdateOperationsInput = {
    set?: bigint | number | null
    increment?: bigint | number
    decrement?: bigint | number
    multiply?: bigint | number
    divide?: bigint | number
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type AudioFileUpdateManyWithoutBookNestedInput = {
    create?: XOR<AudioFileCreateWithoutBookInput, AudioFileUncheckedCreateWithoutBookInput> | AudioFileCreateWithoutBookInput[] | AudioFileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutBookInput | AudioFileCreateOrConnectWithoutBookInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutBookInput | AudioFileUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: AudioFileCreateManyBookInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutBookInput | AudioFileUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutBookInput | AudioFileUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type CharacterMergeAuditUpdateManyWithoutBookNestedInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutBookInput, CharacterMergeAuditUncheckedCreateWithoutBookInput> | CharacterMergeAuditCreateWithoutBookInput[] | CharacterMergeAuditUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutBookInput | CharacterMergeAuditCreateOrConnectWithoutBookInput[]
    upsert?: CharacterMergeAuditUpsertWithWhereUniqueWithoutBookInput | CharacterMergeAuditUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: CharacterMergeAuditCreateManyBookInputEnvelope
    set?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    disconnect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    delete?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    update?: CharacterMergeAuditUpdateWithWhereUniqueWithoutBookInput | CharacterMergeAuditUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: CharacterMergeAuditUpdateManyWithWhereWithoutBookInput | CharacterMergeAuditUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
  }

  export type CharacterProfileUpdateManyWithoutBookNestedInput = {
    create?: XOR<CharacterProfileCreateWithoutBookInput, CharacterProfileUncheckedCreateWithoutBookInput> | CharacterProfileCreateWithoutBookInput[] | CharacterProfileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutBookInput | CharacterProfileCreateOrConnectWithoutBookInput[]
    upsert?: CharacterProfileUpsertWithWhereUniqueWithoutBookInput | CharacterProfileUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: CharacterProfileCreateManyBookInputEnvelope
    set?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    disconnect?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    delete?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    connect?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    update?: CharacterProfileUpdateWithWhereUniqueWithoutBookInput | CharacterProfileUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: CharacterProfileUpdateManyWithWhereWithoutBookInput | CharacterProfileUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: CharacterProfileScalarWhereInput | CharacterProfileScalarWhereInput[]
  }

  export type ProcessingTaskUpdateManyWithoutBookNestedInput = {
    create?: XOR<ProcessingTaskCreateWithoutBookInput, ProcessingTaskUncheckedCreateWithoutBookInput> | ProcessingTaskCreateWithoutBookInput[] | ProcessingTaskUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ProcessingTaskCreateOrConnectWithoutBookInput | ProcessingTaskCreateOrConnectWithoutBookInput[]
    upsert?: ProcessingTaskUpsertWithWhereUniqueWithoutBookInput | ProcessingTaskUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: ProcessingTaskCreateManyBookInputEnvelope
    set?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    disconnect?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    delete?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    connect?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    update?: ProcessingTaskUpdateWithWhereUniqueWithoutBookInput | ProcessingTaskUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: ProcessingTaskUpdateManyWithWhereWithoutBookInput | ProcessingTaskUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: ProcessingTaskScalarWhereInput | ProcessingTaskScalarWhereInput[]
  }

  export type ScriptSentenceUpdateManyWithoutBookNestedInput = {
    create?: XOR<ScriptSentenceCreateWithoutBookInput, ScriptSentenceUncheckedCreateWithoutBookInput> | ScriptSentenceCreateWithoutBookInput[] | ScriptSentenceUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutBookInput | ScriptSentenceCreateOrConnectWithoutBookInput[]
    upsert?: ScriptSentenceUpsertWithWhereUniqueWithoutBookInput | ScriptSentenceUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: ScriptSentenceCreateManyBookInputEnvelope
    set?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    disconnect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    delete?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    update?: ScriptSentenceUpdateWithWhereUniqueWithoutBookInput | ScriptSentenceUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: ScriptSentenceUpdateManyWithWhereWithoutBookInput | ScriptSentenceUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
  }

  export type TextSegmentUpdateManyWithoutBookNestedInput = {
    create?: XOR<TextSegmentCreateWithoutBookInput, TextSegmentUncheckedCreateWithoutBookInput> | TextSegmentCreateWithoutBookInput[] | TextSegmentUncheckedCreateWithoutBookInput[]
    connectOrCreate?: TextSegmentCreateOrConnectWithoutBookInput | TextSegmentCreateOrConnectWithoutBookInput[]
    upsert?: TextSegmentUpsertWithWhereUniqueWithoutBookInput | TextSegmentUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: TextSegmentCreateManyBookInputEnvelope
    set?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    disconnect?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    delete?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    connect?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    update?: TextSegmentUpdateWithWhereUniqueWithoutBookInput | TextSegmentUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: TextSegmentUpdateManyWithWhereWithoutBookInput | TextSegmentUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: TextSegmentScalarWhereInput | TextSegmentScalarWhereInput[]
  }

  export type AudioFileUncheckedUpdateManyWithoutBookNestedInput = {
    create?: XOR<AudioFileCreateWithoutBookInput, AudioFileUncheckedCreateWithoutBookInput> | AudioFileCreateWithoutBookInput[] | AudioFileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutBookInput | AudioFileCreateOrConnectWithoutBookInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutBookInput | AudioFileUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: AudioFileCreateManyBookInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutBookInput | AudioFileUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutBookInput | AudioFileUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type CharacterMergeAuditUncheckedUpdateManyWithoutBookNestedInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutBookInput, CharacterMergeAuditUncheckedCreateWithoutBookInput> | CharacterMergeAuditCreateWithoutBookInput[] | CharacterMergeAuditUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutBookInput | CharacterMergeAuditCreateOrConnectWithoutBookInput[]
    upsert?: CharacterMergeAuditUpsertWithWhereUniqueWithoutBookInput | CharacterMergeAuditUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: CharacterMergeAuditCreateManyBookInputEnvelope
    set?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    disconnect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    delete?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    update?: CharacterMergeAuditUpdateWithWhereUniqueWithoutBookInput | CharacterMergeAuditUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: CharacterMergeAuditUpdateManyWithWhereWithoutBookInput | CharacterMergeAuditUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
  }

  export type CharacterProfileUncheckedUpdateManyWithoutBookNestedInput = {
    create?: XOR<CharacterProfileCreateWithoutBookInput, CharacterProfileUncheckedCreateWithoutBookInput> | CharacterProfileCreateWithoutBookInput[] | CharacterProfileUncheckedCreateWithoutBookInput[]
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutBookInput | CharacterProfileCreateOrConnectWithoutBookInput[]
    upsert?: CharacterProfileUpsertWithWhereUniqueWithoutBookInput | CharacterProfileUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: CharacterProfileCreateManyBookInputEnvelope
    set?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    disconnect?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    delete?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    connect?: CharacterProfileWhereUniqueInput | CharacterProfileWhereUniqueInput[]
    update?: CharacterProfileUpdateWithWhereUniqueWithoutBookInput | CharacterProfileUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: CharacterProfileUpdateManyWithWhereWithoutBookInput | CharacterProfileUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: CharacterProfileScalarWhereInput | CharacterProfileScalarWhereInput[]
  }

  export type ProcessingTaskUncheckedUpdateManyWithoutBookNestedInput = {
    create?: XOR<ProcessingTaskCreateWithoutBookInput, ProcessingTaskUncheckedCreateWithoutBookInput> | ProcessingTaskCreateWithoutBookInput[] | ProcessingTaskUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ProcessingTaskCreateOrConnectWithoutBookInput | ProcessingTaskCreateOrConnectWithoutBookInput[]
    upsert?: ProcessingTaskUpsertWithWhereUniqueWithoutBookInput | ProcessingTaskUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: ProcessingTaskCreateManyBookInputEnvelope
    set?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    disconnect?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    delete?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    connect?: ProcessingTaskWhereUniqueInput | ProcessingTaskWhereUniqueInput[]
    update?: ProcessingTaskUpdateWithWhereUniqueWithoutBookInput | ProcessingTaskUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: ProcessingTaskUpdateManyWithWhereWithoutBookInput | ProcessingTaskUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: ProcessingTaskScalarWhereInput | ProcessingTaskScalarWhereInput[]
  }

  export type ScriptSentenceUncheckedUpdateManyWithoutBookNestedInput = {
    create?: XOR<ScriptSentenceCreateWithoutBookInput, ScriptSentenceUncheckedCreateWithoutBookInput> | ScriptSentenceCreateWithoutBookInput[] | ScriptSentenceUncheckedCreateWithoutBookInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutBookInput | ScriptSentenceCreateOrConnectWithoutBookInput[]
    upsert?: ScriptSentenceUpsertWithWhereUniqueWithoutBookInput | ScriptSentenceUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: ScriptSentenceCreateManyBookInputEnvelope
    set?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    disconnect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    delete?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    update?: ScriptSentenceUpdateWithWhereUniqueWithoutBookInput | ScriptSentenceUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: ScriptSentenceUpdateManyWithWhereWithoutBookInput | ScriptSentenceUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
  }

  export type TextSegmentUncheckedUpdateManyWithoutBookNestedInput = {
    create?: XOR<TextSegmentCreateWithoutBookInput, TextSegmentUncheckedCreateWithoutBookInput> | TextSegmentCreateWithoutBookInput[] | TextSegmentUncheckedCreateWithoutBookInput[]
    connectOrCreate?: TextSegmentCreateOrConnectWithoutBookInput | TextSegmentCreateOrConnectWithoutBookInput[]
    upsert?: TextSegmentUpsertWithWhereUniqueWithoutBookInput | TextSegmentUpsertWithWhereUniqueWithoutBookInput[]
    createMany?: TextSegmentCreateManyBookInputEnvelope
    set?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    disconnect?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    delete?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    connect?: TextSegmentWhereUniqueInput | TextSegmentWhereUniqueInput[]
    update?: TextSegmentUpdateWithWhereUniqueWithoutBookInput | TextSegmentUpdateWithWhereUniqueWithoutBookInput[]
    updateMany?: TextSegmentUpdateManyWithWhereWithoutBookInput | TextSegmentUpdateManyWithWhereWithoutBookInput[]
    deleteMany?: TextSegmentScalarWhereInput | TextSegmentScalarWhereInput[]
  }

  export type CharacterAliasCreateNestedManyWithoutCharacterInput = {
    create?: XOR<CharacterAliasCreateWithoutCharacterInput, CharacterAliasUncheckedCreateWithoutCharacterInput> | CharacterAliasCreateWithoutCharacterInput[] | CharacterAliasUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterAliasCreateOrConnectWithoutCharacterInput | CharacterAliasCreateOrConnectWithoutCharacterInput[]
    createMany?: CharacterAliasCreateManyCharacterInputEnvelope
    connect?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
  }

  export type CharacterMergeAuditCreateNestedManyWithoutSourceCharacterInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput> | CharacterMergeAuditCreateWithoutSourceCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput | CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput[]
    createMany?: CharacterMergeAuditCreateManySourceCharacterInputEnvelope
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
  }

  export type CharacterMergeAuditCreateNestedManyWithoutTargetCharacterInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput> | CharacterMergeAuditCreateWithoutTargetCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput | CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput[]
    createMany?: CharacterMergeAuditCreateManyTargetCharacterInputEnvelope
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
  }

  export type BookCreateNestedOneWithoutCharacterProfilesInput = {
    create?: XOR<BookCreateWithoutCharacterProfilesInput, BookUncheckedCreateWithoutCharacterProfilesInput>
    connectOrCreate?: BookCreateOrConnectWithoutCharacterProfilesInput
    connect?: BookWhereUniqueInput
  }

  export type CharacterVoiceBindingCreateNestedManyWithoutCharacterInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutCharacterInput, CharacterVoiceBindingUncheckedCreateWithoutCharacterInput> | CharacterVoiceBindingCreateWithoutCharacterInput[] | CharacterVoiceBindingUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutCharacterInput | CharacterVoiceBindingCreateOrConnectWithoutCharacterInput[]
    createMany?: CharacterVoiceBindingCreateManyCharacterInputEnvelope
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
  }

  export type ScriptSentenceCreateNestedManyWithoutCharacterInput = {
    create?: XOR<ScriptSentenceCreateWithoutCharacterInput, ScriptSentenceUncheckedCreateWithoutCharacterInput> | ScriptSentenceCreateWithoutCharacterInput[] | ScriptSentenceUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutCharacterInput | ScriptSentenceCreateOrConnectWithoutCharacterInput[]
    createMany?: ScriptSentenceCreateManyCharacterInputEnvelope
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
  }

  export type CharacterAliasUncheckedCreateNestedManyWithoutCharacterInput = {
    create?: XOR<CharacterAliasCreateWithoutCharacterInput, CharacterAliasUncheckedCreateWithoutCharacterInput> | CharacterAliasCreateWithoutCharacterInput[] | CharacterAliasUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterAliasCreateOrConnectWithoutCharacterInput | CharacterAliasCreateOrConnectWithoutCharacterInput[]
    createMany?: CharacterAliasCreateManyCharacterInputEnvelope
    connect?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
  }

  export type CharacterMergeAuditUncheckedCreateNestedManyWithoutSourceCharacterInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput> | CharacterMergeAuditCreateWithoutSourceCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput | CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput[]
    createMany?: CharacterMergeAuditCreateManySourceCharacterInputEnvelope
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
  }

  export type CharacterMergeAuditUncheckedCreateNestedManyWithoutTargetCharacterInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput> | CharacterMergeAuditCreateWithoutTargetCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput | CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput[]
    createMany?: CharacterMergeAuditCreateManyTargetCharacterInputEnvelope
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
  }

  export type CharacterVoiceBindingUncheckedCreateNestedManyWithoutCharacterInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutCharacterInput, CharacterVoiceBindingUncheckedCreateWithoutCharacterInput> | CharacterVoiceBindingCreateWithoutCharacterInput[] | CharacterVoiceBindingUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutCharacterInput | CharacterVoiceBindingCreateOrConnectWithoutCharacterInput[]
    createMany?: CharacterVoiceBindingCreateManyCharacterInputEnvelope
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
  }

  export type ScriptSentenceUncheckedCreateNestedManyWithoutCharacterInput = {
    create?: XOR<ScriptSentenceCreateWithoutCharacterInput, ScriptSentenceUncheckedCreateWithoutCharacterInput> | ScriptSentenceCreateWithoutCharacterInput[] | ScriptSentenceUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutCharacterInput | ScriptSentenceCreateOrConnectWithoutCharacterInput[]
    createMany?: ScriptSentenceCreateManyCharacterInputEnvelope
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type CharacterAliasUpdateManyWithoutCharacterNestedInput = {
    create?: XOR<CharacterAliasCreateWithoutCharacterInput, CharacterAliasUncheckedCreateWithoutCharacterInput> | CharacterAliasCreateWithoutCharacterInput[] | CharacterAliasUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterAliasCreateOrConnectWithoutCharacterInput | CharacterAliasCreateOrConnectWithoutCharacterInput[]
    upsert?: CharacterAliasUpsertWithWhereUniqueWithoutCharacterInput | CharacterAliasUpsertWithWhereUniqueWithoutCharacterInput[]
    createMany?: CharacterAliasCreateManyCharacterInputEnvelope
    set?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    disconnect?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    delete?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    connect?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    update?: CharacterAliasUpdateWithWhereUniqueWithoutCharacterInput | CharacterAliasUpdateWithWhereUniqueWithoutCharacterInput[]
    updateMany?: CharacterAliasUpdateManyWithWhereWithoutCharacterInput | CharacterAliasUpdateManyWithWhereWithoutCharacterInput[]
    deleteMany?: CharacterAliasScalarWhereInput | CharacterAliasScalarWhereInput[]
  }

  export type CharacterMergeAuditUpdateManyWithoutSourceCharacterNestedInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput> | CharacterMergeAuditCreateWithoutSourceCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput | CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput[]
    upsert?: CharacterMergeAuditUpsertWithWhereUniqueWithoutSourceCharacterInput | CharacterMergeAuditUpsertWithWhereUniqueWithoutSourceCharacterInput[]
    createMany?: CharacterMergeAuditCreateManySourceCharacterInputEnvelope
    set?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    disconnect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    delete?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    update?: CharacterMergeAuditUpdateWithWhereUniqueWithoutSourceCharacterInput | CharacterMergeAuditUpdateWithWhereUniqueWithoutSourceCharacterInput[]
    updateMany?: CharacterMergeAuditUpdateManyWithWhereWithoutSourceCharacterInput | CharacterMergeAuditUpdateManyWithWhereWithoutSourceCharacterInput[]
    deleteMany?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
  }

  export type CharacterMergeAuditUpdateManyWithoutTargetCharacterNestedInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput> | CharacterMergeAuditCreateWithoutTargetCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput | CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput[]
    upsert?: CharacterMergeAuditUpsertWithWhereUniqueWithoutTargetCharacterInput | CharacterMergeAuditUpsertWithWhereUniqueWithoutTargetCharacterInput[]
    createMany?: CharacterMergeAuditCreateManyTargetCharacterInputEnvelope
    set?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    disconnect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    delete?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    update?: CharacterMergeAuditUpdateWithWhereUniqueWithoutTargetCharacterInput | CharacterMergeAuditUpdateWithWhereUniqueWithoutTargetCharacterInput[]
    updateMany?: CharacterMergeAuditUpdateManyWithWhereWithoutTargetCharacterInput | CharacterMergeAuditUpdateManyWithWhereWithoutTargetCharacterInput[]
    deleteMany?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
  }

  export type BookUpdateOneRequiredWithoutCharacterProfilesNestedInput = {
    create?: XOR<BookCreateWithoutCharacterProfilesInput, BookUncheckedCreateWithoutCharacterProfilesInput>
    connectOrCreate?: BookCreateOrConnectWithoutCharacterProfilesInput
    upsert?: BookUpsertWithoutCharacterProfilesInput
    connect?: BookWhereUniqueInput
    update?: XOR<XOR<BookUpdateToOneWithWhereWithoutCharacterProfilesInput, BookUpdateWithoutCharacterProfilesInput>, BookUncheckedUpdateWithoutCharacterProfilesInput>
  }

  export type CharacterVoiceBindingUpdateManyWithoutCharacterNestedInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutCharacterInput, CharacterVoiceBindingUncheckedCreateWithoutCharacterInput> | CharacterVoiceBindingCreateWithoutCharacterInput[] | CharacterVoiceBindingUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutCharacterInput | CharacterVoiceBindingCreateOrConnectWithoutCharacterInput[]
    upsert?: CharacterVoiceBindingUpsertWithWhereUniqueWithoutCharacterInput | CharacterVoiceBindingUpsertWithWhereUniqueWithoutCharacterInput[]
    createMany?: CharacterVoiceBindingCreateManyCharacterInputEnvelope
    set?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    disconnect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    delete?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    update?: CharacterVoiceBindingUpdateWithWhereUniqueWithoutCharacterInput | CharacterVoiceBindingUpdateWithWhereUniqueWithoutCharacterInput[]
    updateMany?: CharacterVoiceBindingUpdateManyWithWhereWithoutCharacterInput | CharacterVoiceBindingUpdateManyWithWhereWithoutCharacterInput[]
    deleteMany?: CharacterVoiceBindingScalarWhereInput | CharacterVoiceBindingScalarWhereInput[]
  }

  export type ScriptSentenceUpdateManyWithoutCharacterNestedInput = {
    create?: XOR<ScriptSentenceCreateWithoutCharacterInput, ScriptSentenceUncheckedCreateWithoutCharacterInput> | ScriptSentenceCreateWithoutCharacterInput[] | ScriptSentenceUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutCharacterInput | ScriptSentenceCreateOrConnectWithoutCharacterInput[]
    upsert?: ScriptSentenceUpsertWithWhereUniqueWithoutCharacterInput | ScriptSentenceUpsertWithWhereUniqueWithoutCharacterInput[]
    createMany?: ScriptSentenceCreateManyCharacterInputEnvelope
    set?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    disconnect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    delete?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    update?: ScriptSentenceUpdateWithWhereUniqueWithoutCharacterInput | ScriptSentenceUpdateWithWhereUniqueWithoutCharacterInput[]
    updateMany?: ScriptSentenceUpdateManyWithWhereWithoutCharacterInput | ScriptSentenceUpdateManyWithWhereWithoutCharacterInput[]
    deleteMany?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
  }

  export type CharacterAliasUncheckedUpdateManyWithoutCharacterNestedInput = {
    create?: XOR<CharacterAliasCreateWithoutCharacterInput, CharacterAliasUncheckedCreateWithoutCharacterInput> | CharacterAliasCreateWithoutCharacterInput[] | CharacterAliasUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterAliasCreateOrConnectWithoutCharacterInput | CharacterAliasCreateOrConnectWithoutCharacterInput[]
    upsert?: CharacterAliasUpsertWithWhereUniqueWithoutCharacterInput | CharacterAliasUpsertWithWhereUniqueWithoutCharacterInput[]
    createMany?: CharacterAliasCreateManyCharacterInputEnvelope
    set?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    disconnect?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    delete?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    connect?: CharacterAliasWhereUniqueInput | CharacterAliasWhereUniqueInput[]
    update?: CharacterAliasUpdateWithWhereUniqueWithoutCharacterInput | CharacterAliasUpdateWithWhereUniqueWithoutCharacterInput[]
    updateMany?: CharacterAliasUpdateManyWithWhereWithoutCharacterInput | CharacterAliasUpdateManyWithWhereWithoutCharacterInput[]
    deleteMany?: CharacterAliasScalarWhereInput | CharacterAliasScalarWhereInput[]
  }

  export type CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterNestedInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput> | CharacterMergeAuditCreateWithoutSourceCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput | CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput[]
    upsert?: CharacterMergeAuditUpsertWithWhereUniqueWithoutSourceCharacterInput | CharacterMergeAuditUpsertWithWhereUniqueWithoutSourceCharacterInput[]
    createMany?: CharacterMergeAuditCreateManySourceCharacterInputEnvelope
    set?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    disconnect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    delete?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    update?: CharacterMergeAuditUpdateWithWhereUniqueWithoutSourceCharacterInput | CharacterMergeAuditUpdateWithWhereUniqueWithoutSourceCharacterInput[]
    updateMany?: CharacterMergeAuditUpdateManyWithWhereWithoutSourceCharacterInput | CharacterMergeAuditUpdateManyWithWhereWithoutSourceCharacterInput[]
    deleteMany?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
  }

  export type CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterNestedInput = {
    create?: XOR<CharacterMergeAuditCreateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput> | CharacterMergeAuditCreateWithoutTargetCharacterInput[] | CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput[]
    connectOrCreate?: CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput | CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput[]
    upsert?: CharacterMergeAuditUpsertWithWhereUniqueWithoutTargetCharacterInput | CharacterMergeAuditUpsertWithWhereUniqueWithoutTargetCharacterInput[]
    createMany?: CharacterMergeAuditCreateManyTargetCharacterInputEnvelope
    set?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    disconnect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    delete?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    connect?: CharacterMergeAuditWhereUniqueInput | CharacterMergeAuditWhereUniqueInput[]
    update?: CharacterMergeAuditUpdateWithWhereUniqueWithoutTargetCharacterInput | CharacterMergeAuditUpdateWithWhereUniqueWithoutTargetCharacterInput[]
    updateMany?: CharacterMergeAuditUpdateManyWithWhereWithoutTargetCharacterInput | CharacterMergeAuditUpdateManyWithWhereWithoutTargetCharacterInput[]
    deleteMany?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
  }

  export type CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterNestedInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutCharacterInput, CharacterVoiceBindingUncheckedCreateWithoutCharacterInput> | CharacterVoiceBindingCreateWithoutCharacterInput[] | CharacterVoiceBindingUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutCharacterInput | CharacterVoiceBindingCreateOrConnectWithoutCharacterInput[]
    upsert?: CharacterVoiceBindingUpsertWithWhereUniqueWithoutCharacterInput | CharacterVoiceBindingUpsertWithWhereUniqueWithoutCharacterInput[]
    createMany?: CharacterVoiceBindingCreateManyCharacterInputEnvelope
    set?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    disconnect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    delete?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    update?: CharacterVoiceBindingUpdateWithWhereUniqueWithoutCharacterInput | CharacterVoiceBindingUpdateWithWhereUniqueWithoutCharacterInput[]
    updateMany?: CharacterVoiceBindingUpdateManyWithWhereWithoutCharacterInput | CharacterVoiceBindingUpdateManyWithWhereWithoutCharacterInput[]
    deleteMany?: CharacterVoiceBindingScalarWhereInput | CharacterVoiceBindingScalarWhereInput[]
  }

  export type ScriptSentenceUncheckedUpdateManyWithoutCharacterNestedInput = {
    create?: XOR<ScriptSentenceCreateWithoutCharacterInput, ScriptSentenceUncheckedCreateWithoutCharacterInput> | ScriptSentenceCreateWithoutCharacterInput[] | ScriptSentenceUncheckedCreateWithoutCharacterInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutCharacterInput | ScriptSentenceCreateOrConnectWithoutCharacterInput[]
    upsert?: ScriptSentenceUpsertWithWhereUniqueWithoutCharacterInput | ScriptSentenceUpsertWithWhereUniqueWithoutCharacterInput[]
    createMany?: ScriptSentenceCreateManyCharacterInputEnvelope
    set?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    disconnect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    delete?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    update?: ScriptSentenceUpdateWithWhereUniqueWithoutCharacterInput | ScriptSentenceUpdateWithWhereUniqueWithoutCharacterInput[]
    updateMany?: ScriptSentenceUpdateManyWithWhereWithoutCharacterInput | ScriptSentenceUpdateManyWithWhereWithoutCharacterInput[]
    deleteMany?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
  }

  export type CharacterProfileCreateNestedOneWithoutAliasesInput = {
    create?: XOR<CharacterProfileCreateWithoutAliasesInput, CharacterProfileUncheckedCreateWithoutAliasesInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutAliasesInput
    connect?: CharacterProfileWhereUniqueInput
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type CharacterProfileUpdateOneRequiredWithoutAliasesNestedInput = {
    create?: XOR<CharacterProfileCreateWithoutAliasesInput, CharacterProfileUncheckedCreateWithoutAliasesInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutAliasesInput
    upsert?: CharacterProfileUpsertWithoutAliasesInput
    connect?: CharacterProfileWhereUniqueInput
    update?: XOR<XOR<CharacterProfileUpdateToOneWithWhereWithoutAliasesInput, CharacterProfileUpdateWithoutAliasesInput>, CharacterProfileUncheckedUpdateWithoutAliasesInput>
  }

  export type AudioFileCreateNestedManyWithoutVoiceProfileInput = {
    create?: XOR<AudioFileCreateWithoutVoiceProfileInput, AudioFileUncheckedCreateWithoutVoiceProfileInput> | AudioFileCreateWithoutVoiceProfileInput[] | AudioFileUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutVoiceProfileInput | AudioFileCreateOrConnectWithoutVoiceProfileInput[]
    createMany?: AudioFileCreateManyVoiceProfileInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type CharacterVoiceBindingCreateNestedManyWithoutVoiceProfileInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput> | CharacterVoiceBindingCreateWithoutVoiceProfileInput[] | CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput | CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput[]
    createMany?: CharacterVoiceBindingCreateManyVoiceProfileInputEnvelope
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
  }

  export type AudioFileUncheckedCreateNestedManyWithoutVoiceProfileInput = {
    create?: XOR<AudioFileCreateWithoutVoiceProfileInput, AudioFileUncheckedCreateWithoutVoiceProfileInput> | AudioFileCreateWithoutVoiceProfileInput[] | AudioFileUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutVoiceProfileInput | AudioFileCreateOrConnectWithoutVoiceProfileInput[]
    createMany?: AudioFileCreateManyVoiceProfileInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type CharacterVoiceBindingUncheckedCreateNestedManyWithoutVoiceProfileInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput> | CharacterVoiceBindingCreateWithoutVoiceProfileInput[] | CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput | CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput[]
    createMany?: CharacterVoiceBindingCreateManyVoiceProfileInputEnvelope
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
  }

  export type AudioFileUpdateManyWithoutVoiceProfileNestedInput = {
    create?: XOR<AudioFileCreateWithoutVoiceProfileInput, AudioFileUncheckedCreateWithoutVoiceProfileInput> | AudioFileCreateWithoutVoiceProfileInput[] | AudioFileUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutVoiceProfileInput | AudioFileCreateOrConnectWithoutVoiceProfileInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutVoiceProfileInput | AudioFileUpsertWithWhereUniqueWithoutVoiceProfileInput[]
    createMany?: AudioFileCreateManyVoiceProfileInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutVoiceProfileInput | AudioFileUpdateWithWhereUniqueWithoutVoiceProfileInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutVoiceProfileInput | AudioFileUpdateManyWithWhereWithoutVoiceProfileInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type CharacterVoiceBindingUpdateManyWithoutVoiceProfileNestedInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput> | CharacterVoiceBindingCreateWithoutVoiceProfileInput[] | CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput | CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput[]
    upsert?: CharacterVoiceBindingUpsertWithWhereUniqueWithoutVoiceProfileInput | CharacterVoiceBindingUpsertWithWhereUniqueWithoutVoiceProfileInput[]
    createMany?: CharacterVoiceBindingCreateManyVoiceProfileInputEnvelope
    set?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    disconnect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    delete?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    update?: CharacterVoiceBindingUpdateWithWhereUniqueWithoutVoiceProfileInput | CharacterVoiceBindingUpdateWithWhereUniqueWithoutVoiceProfileInput[]
    updateMany?: CharacterVoiceBindingUpdateManyWithWhereWithoutVoiceProfileInput | CharacterVoiceBindingUpdateManyWithWhereWithoutVoiceProfileInput[]
    deleteMany?: CharacterVoiceBindingScalarWhereInput | CharacterVoiceBindingScalarWhereInput[]
  }

  export type AudioFileUncheckedUpdateManyWithoutVoiceProfileNestedInput = {
    create?: XOR<AudioFileCreateWithoutVoiceProfileInput, AudioFileUncheckedCreateWithoutVoiceProfileInput> | AudioFileCreateWithoutVoiceProfileInput[] | AudioFileUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutVoiceProfileInput | AudioFileCreateOrConnectWithoutVoiceProfileInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutVoiceProfileInput | AudioFileUpsertWithWhereUniqueWithoutVoiceProfileInput[]
    createMany?: AudioFileCreateManyVoiceProfileInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutVoiceProfileInput | AudioFileUpdateWithWhereUniqueWithoutVoiceProfileInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutVoiceProfileInput | AudioFileUpdateManyWithWhereWithoutVoiceProfileInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type CharacterVoiceBindingUncheckedUpdateManyWithoutVoiceProfileNestedInput = {
    create?: XOR<CharacterVoiceBindingCreateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput> | CharacterVoiceBindingCreateWithoutVoiceProfileInput[] | CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput[]
    connectOrCreate?: CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput | CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput[]
    upsert?: CharacterVoiceBindingUpsertWithWhereUniqueWithoutVoiceProfileInput | CharacterVoiceBindingUpsertWithWhereUniqueWithoutVoiceProfileInput[]
    createMany?: CharacterVoiceBindingCreateManyVoiceProfileInputEnvelope
    set?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    disconnect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    delete?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    connect?: CharacterVoiceBindingWhereUniqueInput | CharacterVoiceBindingWhereUniqueInput[]
    update?: CharacterVoiceBindingUpdateWithWhereUniqueWithoutVoiceProfileInput | CharacterVoiceBindingUpdateWithWhereUniqueWithoutVoiceProfileInput[]
    updateMany?: CharacterVoiceBindingUpdateManyWithWhereWithoutVoiceProfileInput | CharacterVoiceBindingUpdateManyWithWhereWithoutVoiceProfileInput[]
    deleteMany?: CharacterVoiceBindingScalarWhereInput | CharacterVoiceBindingScalarWhereInput[]
  }

  export type CharacterProfileCreateNestedOneWithoutVoiceBindingsInput = {
    create?: XOR<CharacterProfileCreateWithoutVoiceBindingsInput, CharacterProfileUncheckedCreateWithoutVoiceBindingsInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutVoiceBindingsInput
    connect?: CharacterProfileWhereUniqueInput
  }

  export type TTSVoiceProfileCreateNestedOneWithoutVoiceBindingsInput = {
    create?: XOR<TTSVoiceProfileCreateWithoutVoiceBindingsInput, TTSVoiceProfileUncheckedCreateWithoutVoiceBindingsInput>
    connectOrCreate?: TTSVoiceProfileCreateOrConnectWithoutVoiceBindingsInput
    connect?: TTSVoiceProfileWhereUniqueInput
  }

  export type CharacterProfileUpdateOneRequiredWithoutVoiceBindingsNestedInput = {
    create?: XOR<CharacterProfileCreateWithoutVoiceBindingsInput, CharacterProfileUncheckedCreateWithoutVoiceBindingsInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutVoiceBindingsInput
    upsert?: CharacterProfileUpsertWithoutVoiceBindingsInput
    connect?: CharacterProfileWhereUniqueInput
    update?: XOR<XOR<CharacterProfileUpdateToOneWithWhereWithoutVoiceBindingsInput, CharacterProfileUpdateWithoutVoiceBindingsInput>, CharacterProfileUncheckedUpdateWithoutVoiceBindingsInput>
  }

  export type TTSVoiceProfileUpdateOneRequiredWithoutVoiceBindingsNestedInput = {
    create?: XOR<TTSVoiceProfileCreateWithoutVoiceBindingsInput, TTSVoiceProfileUncheckedCreateWithoutVoiceBindingsInput>
    connectOrCreate?: TTSVoiceProfileCreateOrConnectWithoutVoiceBindingsInput
    upsert?: TTSVoiceProfileUpsertWithoutVoiceBindingsInput
    connect?: TTSVoiceProfileWhereUniqueInput
    update?: XOR<XOR<TTSVoiceProfileUpdateToOneWithWhereWithoutVoiceBindingsInput, TTSVoiceProfileUpdateWithoutVoiceBindingsInput>, TTSVoiceProfileUncheckedUpdateWithoutVoiceBindingsInput>
  }

  export type AudioFileCreateNestedManyWithoutSegmentInput = {
    create?: XOR<AudioFileCreateWithoutSegmentInput, AudioFileUncheckedCreateWithoutSegmentInput> | AudioFileCreateWithoutSegmentInput[] | AudioFileUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutSegmentInput | AudioFileCreateOrConnectWithoutSegmentInput[]
    createMany?: AudioFileCreateManySegmentInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type ScriptSentenceCreateNestedManyWithoutSegmentInput = {
    create?: XOR<ScriptSentenceCreateWithoutSegmentInput, ScriptSentenceUncheckedCreateWithoutSegmentInput> | ScriptSentenceCreateWithoutSegmentInput[] | ScriptSentenceUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutSegmentInput | ScriptSentenceCreateOrConnectWithoutSegmentInput[]
    createMany?: ScriptSentenceCreateManySegmentInputEnvelope
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
  }

  export type BookCreateNestedOneWithoutTextSegmentsInput = {
    create?: XOR<BookCreateWithoutTextSegmentsInput, BookUncheckedCreateWithoutTextSegmentsInput>
    connectOrCreate?: BookCreateOrConnectWithoutTextSegmentsInput
    connect?: BookWhereUniqueInput
  }

  export type AudioFileUncheckedCreateNestedManyWithoutSegmentInput = {
    create?: XOR<AudioFileCreateWithoutSegmentInput, AudioFileUncheckedCreateWithoutSegmentInput> | AudioFileCreateWithoutSegmentInput[] | AudioFileUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutSegmentInput | AudioFileCreateOrConnectWithoutSegmentInput[]
    createMany?: AudioFileCreateManySegmentInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type ScriptSentenceUncheckedCreateNestedManyWithoutSegmentInput = {
    create?: XOR<ScriptSentenceCreateWithoutSegmentInput, ScriptSentenceUncheckedCreateWithoutSegmentInput> | ScriptSentenceCreateWithoutSegmentInput[] | ScriptSentenceUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutSegmentInput | ScriptSentenceCreateOrConnectWithoutSegmentInput[]
    createMany?: ScriptSentenceCreateManySegmentInputEnvelope
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
  }

  export type AudioFileUpdateManyWithoutSegmentNestedInput = {
    create?: XOR<AudioFileCreateWithoutSegmentInput, AudioFileUncheckedCreateWithoutSegmentInput> | AudioFileCreateWithoutSegmentInput[] | AudioFileUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutSegmentInput | AudioFileCreateOrConnectWithoutSegmentInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutSegmentInput | AudioFileUpsertWithWhereUniqueWithoutSegmentInput[]
    createMany?: AudioFileCreateManySegmentInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutSegmentInput | AudioFileUpdateWithWhereUniqueWithoutSegmentInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutSegmentInput | AudioFileUpdateManyWithWhereWithoutSegmentInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type ScriptSentenceUpdateManyWithoutSegmentNestedInput = {
    create?: XOR<ScriptSentenceCreateWithoutSegmentInput, ScriptSentenceUncheckedCreateWithoutSegmentInput> | ScriptSentenceCreateWithoutSegmentInput[] | ScriptSentenceUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutSegmentInput | ScriptSentenceCreateOrConnectWithoutSegmentInput[]
    upsert?: ScriptSentenceUpsertWithWhereUniqueWithoutSegmentInput | ScriptSentenceUpsertWithWhereUniqueWithoutSegmentInput[]
    createMany?: ScriptSentenceCreateManySegmentInputEnvelope
    set?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    disconnect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    delete?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    update?: ScriptSentenceUpdateWithWhereUniqueWithoutSegmentInput | ScriptSentenceUpdateWithWhereUniqueWithoutSegmentInput[]
    updateMany?: ScriptSentenceUpdateManyWithWhereWithoutSegmentInput | ScriptSentenceUpdateManyWithWhereWithoutSegmentInput[]
    deleteMany?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
  }

  export type BookUpdateOneRequiredWithoutTextSegmentsNestedInput = {
    create?: XOR<BookCreateWithoutTextSegmentsInput, BookUncheckedCreateWithoutTextSegmentsInput>
    connectOrCreate?: BookCreateOrConnectWithoutTextSegmentsInput
    upsert?: BookUpsertWithoutTextSegmentsInput
    connect?: BookWhereUniqueInput
    update?: XOR<XOR<BookUpdateToOneWithWhereWithoutTextSegmentsInput, BookUpdateWithoutTextSegmentsInput>, BookUncheckedUpdateWithoutTextSegmentsInput>
  }

  export type AudioFileUncheckedUpdateManyWithoutSegmentNestedInput = {
    create?: XOR<AudioFileCreateWithoutSegmentInput, AudioFileUncheckedCreateWithoutSegmentInput> | AudioFileCreateWithoutSegmentInput[] | AudioFileUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutSegmentInput | AudioFileCreateOrConnectWithoutSegmentInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutSegmentInput | AudioFileUpsertWithWhereUniqueWithoutSegmentInput[]
    createMany?: AudioFileCreateManySegmentInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutSegmentInput | AudioFileUpdateWithWhereUniqueWithoutSegmentInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutSegmentInput | AudioFileUpdateManyWithWhereWithoutSegmentInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type ScriptSentenceUncheckedUpdateManyWithoutSegmentNestedInput = {
    create?: XOR<ScriptSentenceCreateWithoutSegmentInput, ScriptSentenceUncheckedCreateWithoutSegmentInput> | ScriptSentenceCreateWithoutSegmentInput[] | ScriptSentenceUncheckedCreateWithoutSegmentInput[]
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutSegmentInput | ScriptSentenceCreateOrConnectWithoutSegmentInput[]
    upsert?: ScriptSentenceUpsertWithWhereUniqueWithoutSegmentInput | ScriptSentenceUpsertWithWhereUniqueWithoutSegmentInput[]
    createMany?: ScriptSentenceCreateManySegmentInputEnvelope
    set?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    disconnect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    delete?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    connect?: ScriptSentenceWhereUniqueInput | ScriptSentenceWhereUniqueInput[]
    update?: ScriptSentenceUpdateWithWhereUniqueWithoutSegmentInput | ScriptSentenceUpdateWithWhereUniqueWithoutSegmentInput[]
    updateMany?: ScriptSentenceUpdateManyWithWhereWithoutSegmentInput | ScriptSentenceUpdateManyWithWhereWithoutSegmentInput[]
    deleteMany?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
  }

  export type AudioFileCreateNestedManyWithoutScriptSentenceInput = {
    create?: XOR<AudioFileCreateWithoutScriptSentenceInput, AudioFileUncheckedCreateWithoutScriptSentenceInput> | AudioFileCreateWithoutScriptSentenceInput[] | AudioFileUncheckedCreateWithoutScriptSentenceInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutScriptSentenceInput | AudioFileCreateOrConnectWithoutScriptSentenceInput[]
    createMany?: AudioFileCreateManyScriptSentenceInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type BookCreateNestedOneWithoutScriptSentencesInput = {
    create?: XOR<BookCreateWithoutScriptSentencesInput, BookUncheckedCreateWithoutScriptSentencesInput>
    connectOrCreate?: BookCreateOrConnectWithoutScriptSentencesInput
    connect?: BookWhereUniqueInput
  }

  export type CharacterProfileCreateNestedOneWithoutScriptSentencesInput = {
    create?: XOR<CharacterProfileCreateWithoutScriptSentencesInput, CharacterProfileUncheckedCreateWithoutScriptSentencesInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutScriptSentencesInput
    connect?: CharacterProfileWhereUniqueInput
  }

  export type TextSegmentCreateNestedOneWithoutScriptSentencesInput = {
    create?: XOR<TextSegmentCreateWithoutScriptSentencesInput, TextSegmentUncheckedCreateWithoutScriptSentencesInput>
    connectOrCreate?: TextSegmentCreateOrConnectWithoutScriptSentencesInput
    connect?: TextSegmentWhereUniqueInput
  }

  export type AudioFileUncheckedCreateNestedManyWithoutScriptSentenceInput = {
    create?: XOR<AudioFileCreateWithoutScriptSentenceInput, AudioFileUncheckedCreateWithoutScriptSentenceInput> | AudioFileCreateWithoutScriptSentenceInput[] | AudioFileUncheckedCreateWithoutScriptSentenceInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutScriptSentenceInput | AudioFileCreateOrConnectWithoutScriptSentenceInput[]
    createMany?: AudioFileCreateManyScriptSentenceInputEnvelope
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
  }

  export type NullableDecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string | null
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type AudioFileUpdateManyWithoutScriptSentenceNestedInput = {
    create?: XOR<AudioFileCreateWithoutScriptSentenceInput, AudioFileUncheckedCreateWithoutScriptSentenceInput> | AudioFileCreateWithoutScriptSentenceInput[] | AudioFileUncheckedCreateWithoutScriptSentenceInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutScriptSentenceInput | AudioFileCreateOrConnectWithoutScriptSentenceInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutScriptSentenceInput | AudioFileUpsertWithWhereUniqueWithoutScriptSentenceInput[]
    createMany?: AudioFileCreateManyScriptSentenceInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutScriptSentenceInput | AudioFileUpdateWithWhereUniqueWithoutScriptSentenceInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutScriptSentenceInput | AudioFileUpdateManyWithWhereWithoutScriptSentenceInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type BookUpdateOneRequiredWithoutScriptSentencesNestedInput = {
    create?: XOR<BookCreateWithoutScriptSentencesInput, BookUncheckedCreateWithoutScriptSentencesInput>
    connectOrCreate?: BookCreateOrConnectWithoutScriptSentencesInput
    upsert?: BookUpsertWithoutScriptSentencesInput
    connect?: BookWhereUniqueInput
    update?: XOR<XOR<BookUpdateToOneWithWhereWithoutScriptSentencesInput, BookUpdateWithoutScriptSentencesInput>, BookUncheckedUpdateWithoutScriptSentencesInput>
  }

  export type CharacterProfileUpdateOneWithoutScriptSentencesNestedInput = {
    create?: XOR<CharacterProfileCreateWithoutScriptSentencesInput, CharacterProfileUncheckedCreateWithoutScriptSentencesInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutScriptSentencesInput
    upsert?: CharacterProfileUpsertWithoutScriptSentencesInput
    disconnect?: CharacterProfileWhereInput | boolean
    delete?: CharacterProfileWhereInput | boolean
    connect?: CharacterProfileWhereUniqueInput
    update?: XOR<XOR<CharacterProfileUpdateToOneWithWhereWithoutScriptSentencesInput, CharacterProfileUpdateWithoutScriptSentencesInput>, CharacterProfileUncheckedUpdateWithoutScriptSentencesInput>
  }

  export type TextSegmentUpdateOneRequiredWithoutScriptSentencesNestedInput = {
    create?: XOR<TextSegmentCreateWithoutScriptSentencesInput, TextSegmentUncheckedCreateWithoutScriptSentencesInput>
    connectOrCreate?: TextSegmentCreateOrConnectWithoutScriptSentencesInput
    upsert?: TextSegmentUpsertWithoutScriptSentencesInput
    connect?: TextSegmentWhereUniqueInput
    update?: XOR<XOR<TextSegmentUpdateToOneWithWhereWithoutScriptSentencesInput, TextSegmentUpdateWithoutScriptSentencesInput>, TextSegmentUncheckedUpdateWithoutScriptSentencesInput>
  }

  export type AudioFileUncheckedUpdateManyWithoutScriptSentenceNestedInput = {
    create?: XOR<AudioFileCreateWithoutScriptSentenceInput, AudioFileUncheckedCreateWithoutScriptSentenceInput> | AudioFileCreateWithoutScriptSentenceInput[] | AudioFileUncheckedCreateWithoutScriptSentenceInput[]
    connectOrCreate?: AudioFileCreateOrConnectWithoutScriptSentenceInput | AudioFileCreateOrConnectWithoutScriptSentenceInput[]
    upsert?: AudioFileUpsertWithWhereUniqueWithoutScriptSentenceInput | AudioFileUpsertWithWhereUniqueWithoutScriptSentenceInput[]
    createMany?: AudioFileCreateManyScriptSentenceInputEnvelope
    set?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    disconnect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    delete?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    connect?: AudioFileWhereUniqueInput | AudioFileWhereUniqueInput[]
    update?: AudioFileUpdateWithWhereUniqueWithoutScriptSentenceInput | AudioFileUpdateWithWhereUniqueWithoutScriptSentenceInput[]
    updateMany?: AudioFileUpdateManyWithWhereWithoutScriptSentenceInput | AudioFileUpdateManyWithWhereWithoutScriptSentenceInput[]
    deleteMany?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
  }

  export type BookCreateNestedOneWithoutAudioFilesInput = {
    create?: XOR<BookCreateWithoutAudioFilesInput, BookUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: BookCreateOrConnectWithoutAudioFilesInput
    connect?: BookWhereUniqueInput
  }

  export type TextSegmentCreateNestedOneWithoutAudioFilesInput = {
    create?: XOR<TextSegmentCreateWithoutAudioFilesInput, TextSegmentUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: TextSegmentCreateOrConnectWithoutAudioFilesInput
    connect?: TextSegmentWhereUniqueInput
  }

  export type ScriptSentenceCreateNestedOneWithoutAudioFilesInput = {
    create?: XOR<ScriptSentenceCreateWithoutAudioFilesInput, ScriptSentenceUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutAudioFilesInput
    connect?: ScriptSentenceWhereUniqueInput
  }

  export type TTSVoiceProfileCreateNestedOneWithoutAudioFilesInput = {
    create?: XOR<TTSVoiceProfileCreateWithoutAudioFilesInput, TTSVoiceProfileUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: TTSVoiceProfileCreateOrConnectWithoutAudioFilesInput
    connect?: TTSVoiceProfileWhereUniqueInput
  }

  export type BookUpdateOneRequiredWithoutAudioFilesNestedInput = {
    create?: XOR<BookCreateWithoutAudioFilesInput, BookUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: BookCreateOrConnectWithoutAudioFilesInput
    upsert?: BookUpsertWithoutAudioFilesInput
    connect?: BookWhereUniqueInput
    update?: XOR<XOR<BookUpdateToOneWithWhereWithoutAudioFilesInput, BookUpdateWithoutAudioFilesInput>, BookUncheckedUpdateWithoutAudioFilesInput>
  }

  export type TextSegmentUpdateOneWithoutAudioFilesNestedInput = {
    create?: XOR<TextSegmentCreateWithoutAudioFilesInput, TextSegmentUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: TextSegmentCreateOrConnectWithoutAudioFilesInput
    upsert?: TextSegmentUpsertWithoutAudioFilesInput
    disconnect?: TextSegmentWhereInput | boolean
    delete?: TextSegmentWhereInput | boolean
    connect?: TextSegmentWhereUniqueInput
    update?: XOR<XOR<TextSegmentUpdateToOneWithWhereWithoutAudioFilesInput, TextSegmentUpdateWithoutAudioFilesInput>, TextSegmentUncheckedUpdateWithoutAudioFilesInput>
  }

  export type ScriptSentenceUpdateOneWithoutAudioFilesNestedInput = {
    create?: XOR<ScriptSentenceCreateWithoutAudioFilesInput, ScriptSentenceUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: ScriptSentenceCreateOrConnectWithoutAudioFilesInput
    upsert?: ScriptSentenceUpsertWithoutAudioFilesInput
    disconnect?: ScriptSentenceWhereInput | boolean
    delete?: ScriptSentenceWhereInput | boolean
    connect?: ScriptSentenceWhereUniqueInput
    update?: XOR<XOR<ScriptSentenceUpdateToOneWithWhereWithoutAudioFilesInput, ScriptSentenceUpdateWithoutAudioFilesInput>, ScriptSentenceUncheckedUpdateWithoutAudioFilesInput>
  }

  export type TTSVoiceProfileUpdateOneWithoutAudioFilesNestedInput = {
    create?: XOR<TTSVoiceProfileCreateWithoutAudioFilesInput, TTSVoiceProfileUncheckedCreateWithoutAudioFilesInput>
    connectOrCreate?: TTSVoiceProfileCreateOrConnectWithoutAudioFilesInput
    upsert?: TTSVoiceProfileUpsertWithoutAudioFilesInput
    disconnect?: TTSVoiceProfileWhereInput | boolean
    delete?: TTSVoiceProfileWhereInput | boolean
    connect?: TTSVoiceProfileWhereUniqueInput
    update?: XOR<XOR<TTSVoiceProfileUpdateToOneWithWhereWithoutAudioFilesInput, TTSVoiceProfileUpdateWithoutAudioFilesInput>, TTSVoiceProfileUncheckedUpdateWithoutAudioFilesInput>
  }

  export type BookCreateNestedOneWithoutMergeAuditsInput = {
    create?: XOR<BookCreateWithoutMergeAuditsInput, BookUncheckedCreateWithoutMergeAuditsInput>
    connectOrCreate?: BookCreateOrConnectWithoutMergeAuditsInput
    connect?: BookWhereUniqueInput
  }

  export type CharacterProfileCreateNestedOneWithoutMergeAuditsSourceInput = {
    create?: XOR<CharacterProfileCreateWithoutMergeAuditsSourceInput, CharacterProfileUncheckedCreateWithoutMergeAuditsSourceInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutMergeAuditsSourceInput
    connect?: CharacterProfileWhereUniqueInput
  }

  export type CharacterProfileCreateNestedOneWithoutMergeAuditsTargetInput = {
    create?: XOR<CharacterProfileCreateWithoutMergeAuditsTargetInput, CharacterProfileUncheckedCreateWithoutMergeAuditsTargetInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutMergeAuditsTargetInput
    connect?: CharacterProfileWhereUniqueInput
  }

  export type BookUpdateOneRequiredWithoutMergeAuditsNestedInput = {
    create?: XOR<BookCreateWithoutMergeAuditsInput, BookUncheckedCreateWithoutMergeAuditsInput>
    connectOrCreate?: BookCreateOrConnectWithoutMergeAuditsInput
    upsert?: BookUpsertWithoutMergeAuditsInput
    connect?: BookWhereUniqueInput
    update?: XOR<XOR<BookUpdateToOneWithWhereWithoutMergeAuditsInput, BookUpdateWithoutMergeAuditsInput>, BookUncheckedUpdateWithoutMergeAuditsInput>
  }

  export type CharacterProfileUpdateOneRequiredWithoutMergeAuditsSourceNestedInput = {
    create?: XOR<CharacterProfileCreateWithoutMergeAuditsSourceInput, CharacterProfileUncheckedCreateWithoutMergeAuditsSourceInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutMergeAuditsSourceInput
    upsert?: CharacterProfileUpsertWithoutMergeAuditsSourceInput
    connect?: CharacterProfileWhereUniqueInput
    update?: XOR<XOR<CharacterProfileUpdateToOneWithWhereWithoutMergeAuditsSourceInput, CharacterProfileUpdateWithoutMergeAuditsSourceInput>, CharacterProfileUncheckedUpdateWithoutMergeAuditsSourceInput>
  }

  export type CharacterProfileUpdateOneRequiredWithoutMergeAuditsTargetNestedInput = {
    create?: XOR<CharacterProfileCreateWithoutMergeAuditsTargetInput, CharacterProfileUncheckedCreateWithoutMergeAuditsTargetInput>
    connectOrCreate?: CharacterProfileCreateOrConnectWithoutMergeAuditsTargetInput
    upsert?: CharacterProfileUpsertWithoutMergeAuditsTargetInput
    connect?: CharacterProfileWhereUniqueInput
    update?: XOR<XOR<CharacterProfileUpdateToOneWithWhereWithoutMergeAuditsTargetInput, CharacterProfileUpdateWithoutMergeAuditsTargetInput>, CharacterProfileUncheckedUpdateWithoutMergeAuditsTargetInput>
  }

  export type BookCreateNestedOneWithoutProcessingTasksInput = {
    create?: XOR<BookCreateWithoutProcessingTasksInput, BookUncheckedCreateWithoutProcessingTasksInput>
    connectOrCreate?: BookCreateOrConnectWithoutProcessingTasksInput
    connect?: BookWhereUniqueInput
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type BookUpdateOneRequiredWithoutProcessingTasksNestedInput = {
    create?: XOR<BookCreateWithoutProcessingTasksInput, BookUncheckedCreateWithoutProcessingTasksInput>
    connectOrCreate?: BookCreateOrConnectWithoutProcessingTasksInput
    upsert?: BookUpsertWithoutProcessingTasksInput
    connect?: BookWhereUniqueInput
    update?: XOR<XOR<BookUpdateToOneWithWhereWithoutProcessingTasksInput, BookUpdateWithoutProcessingTasksInput>, BookUncheckedUpdateWithoutProcessingTasksInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedBigIntNullableFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableFilter<$PrismaModel> | bigint | number | null
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedBigIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: bigint | number | BigIntFieldRefInput<$PrismaModel> | null
    in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel> | null
    lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
    not?: NestedBigIntNullableWithAggregatesFilter<$PrismaModel> | bigint | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedBigIntNullableFilter<$PrismaModel>
    _min?: NestedBigIntNullableFilter<$PrismaModel>
    _max?: NestedBigIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type AudioFileCreateWithoutBookInput = {
    id?: string
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    segment?: TextSegmentCreateNestedOneWithoutAudioFilesInput
    scriptSentence?: ScriptSentenceCreateNestedOneWithoutAudioFilesInput
    voiceProfile?: TTSVoiceProfileCreateNestedOneWithoutAudioFilesInput
  }

  export type AudioFileUncheckedCreateWithoutBookInput = {
    id?: string
    sentenceId?: string | null
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileCreateOrConnectWithoutBookInput = {
    where: AudioFileWhereUniqueInput
    create: XOR<AudioFileCreateWithoutBookInput, AudioFileUncheckedCreateWithoutBookInput>
  }

  export type AudioFileCreateManyBookInputEnvelope = {
    data: AudioFileCreateManyBookInput | AudioFileCreateManyBookInput[]
    skipDuplicates?: boolean
  }

  export type CharacterMergeAuditCreateWithoutBookInput = {
    id?: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
    sourceCharacter: CharacterProfileCreateNestedOneWithoutMergeAuditsSourceInput
    targetCharacter: CharacterProfileCreateNestedOneWithoutMergeAuditsTargetInput
  }

  export type CharacterMergeAuditUncheckedCreateWithoutBookInput = {
    id?: string
    sourceCharacterId: string
    targetCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterMergeAuditCreateOrConnectWithoutBookInput = {
    where: CharacterMergeAuditWhereUniqueInput
    create: XOR<CharacterMergeAuditCreateWithoutBookInput, CharacterMergeAuditUncheckedCreateWithoutBookInput>
  }

  export type CharacterMergeAuditCreateManyBookInputEnvelope = {
    data: CharacterMergeAuditCreateManyBookInput | CharacterMergeAuditCreateManyBookInput[]
    skipDuplicates?: boolean
  }

  export type CharacterProfileCreateWithoutBookInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditCreateNestedManyWithoutTargetCharacterInput
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUncheckedCreateWithoutBookInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasUncheckedCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedCreateNestedManyWithoutTargetCharacterInput
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileCreateOrConnectWithoutBookInput = {
    where: CharacterProfileWhereUniqueInput
    create: XOR<CharacterProfileCreateWithoutBookInput, CharacterProfileUncheckedCreateWithoutBookInput>
  }

  export type CharacterProfileCreateManyBookInputEnvelope = {
    data: CharacterProfileCreateManyBookInput | CharacterProfileCreateManyBookInput[]
    skipDuplicates?: boolean
  }

  export type ProcessingTaskCreateWithoutBookInput = {
    id?: string
    taskType: string
    status?: string
    progress?: number
    totalItems?: number
    processedItems?: number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: string | null
    externalTaskId?: string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProcessingTaskUncheckedCreateWithoutBookInput = {
    id?: string
    taskType: string
    status?: string
    progress?: number
    totalItems?: number
    processedItems?: number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: string | null
    externalTaskId?: string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProcessingTaskCreateOrConnectWithoutBookInput = {
    where: ProcessingTaskWhereUniqueInput
    create: XOR<ProcessingTaskCreateWithoutBookInput, ProcessingTaskUncheckedCreateWithoutBookInput>
  }

  export type ProcessingTaskCreateManyBookInputEnvelope = {
    data: ProcessingTaskCreateManyBookInput | ProcessingTaskCreateManyBookInput[]
    skipDuplicates?: boolean
  }

  export type ScriptSentenceCreateWithoutBookInput = {
    id?: string
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutScriptSentenceInput
    character?: CharacterProfileCreateNestedOneWithoutScriptSentencesInput
    segment: TextSegmentCreateNestedOneWithoutScriptSentencesInput
  }

  export type ScriptSentenceUncheckedCreateWithoutBookInput = {
    id?: string
    segmentId: string
    characterId?: string | null
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutScriptSentenceInput
  }

  export type ScriptSentenceCreateOrConnectWithoutBookInput = {
    where: ScriptSentenceWhereUniqueInput
    create: XOR<ScriptSentenceCreateWithoutBookInput, ScriptSentenceUncheckedCreateWithoutBookInput>
  }

  export type ScriptSentenceCreateManyBookInputEnvelope = {
    data: ScriptSentenceCreateManyBookInput | ScriptSentenceCreateManyBookInput[]
    skipDuplicates?: boolean
  }

  export type TextSegmentCreateWithoutBookInput = {
    id?: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutSegmentInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutSegmentInput
  }

  export type TextSegmentUncheckedCreateWithoutBookInput = {
    id?: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutSegmentInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutSegmentInput
  }

  export type TextSegmentCreateOrConnectWithoutBookInput = {
    where: TextSegmentWhereUniqueInput
    create: XOR<TextSegmentCreateWithoutBookInput, TextSegmentUncheckedCreateWithoutBookInput>
  }

  export type TextSegmentCreateManyBookInputEnvelope = {
    data: TextSegmentCreateManyBookInput | TextSegmentCreateManyBookInput[]
    skipDuplicates?: boolean
  }

  export type AudioFileUpsertWithWhereUniqueWithoutBookInput = {
    where: AudioFileWhereUniqueInput
    update: XOR<AudioFileUpdateWithoutBookInput, AudioFileUncheckedUpdateWithoutBookInput>
    create: XOR<AudioFileCreateWithoutBookInput, AudioFileUncheckedCreateWithoutBookInput>
  }

  export type AudioFileUpdateWithWhereUniqueWithoutBookInput = {
    where: AudioFileWhereUniqueInput
    data: XOR<AudioFileUpdateWithoutBookInput, AudioFileUncheckedUpdateWithoutBookInput>
  }

  export type AudioFileUpdateManyWithWhereWithoutBookInput = {
    where: AudioFileScalarWhereInput
    data: XOR<AudioFileUpdateManyMutationInput, AudioFileUncheckedUpdateManyWithoutBookInput>
  }

  export type AudioFileScalarWhereInput = {
    AND?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
    OR?: AudioFileScalarWhereInput[]
    NOT?: AudioFileScalarWhereInput | AudioFileScalarWhereInput[]
    id?: StringFilter<"AudioFile"> | string
    bookId?: StringFilter<"AudioFile"> | string
    sentenceId?: StringNullableFilter<"AudioFile"> | string | null
    segmentId?: StringNullableFilter<"AudioFile"> | string | null
    filePath?: StringFilter<"AudioFile"> | string
    fileName?: StringNullableFilter<"AudioFile"> | string | null
    duration?: DecimalNullableFilter<"AudioFile"> | Decimal | DecimalJsLike | number | string | null
    fileSize?: BigIntNullableFilter<"AudioFile"> | bigint | number | null
    format?: StringNullableFilter<"AudioFile"> | string | null
    status?: StringFilter<"AudioFile"> | string
    errorMessage?: StringNullableFilter<"AudioFile"> | string | null
    retryCount?: IntFilter<"AudioFile"> | number
    provider?: StringNullableFilter<"AudioFile"> | string | null
    voiceProfileId?: StringNullableFilter<"AudioFile"> | string | null
    createdAt?: DateTimeFilter<"AudioFile"> | Date | string
    updatedAt?: DateTimeFilter<"AudioFile"> | Date | string
  }

  export type CharacterMergeAuditUpsertWithWhereUniqueWithoutBookInput = {
    where: CharacterMergeAuditWhereUniqueInput
    update: XOR<CharacterMergeAuditUpdateWithoutBookInput, CharacterMergeAuditUncheckedUpdateWithoutBookInput>
    create: XOR<CharacterMergeAuditCreateWithoutBookInput, CharacterMergeAuditUncheckedCreateWithoutBookInput>
  }

  export type CharacterMergeAuditUpdateWithWhereUniqueWithoutBookInput = {
    where: CharacterMergeAuditWhereUniqueInput
    data: XOR<CharacterMergeAuditUpdateWithoutBookInput, CharacterMergeAuditUncheckedUpdateWithoutBookInput>
  }

  export type CharacterMergeAuditUpdateManyWithWhereWithoutBookInput = {
    where: CharacterMergeAuditScalarWhereInput
    data: XOR<CharacterMergeAuditUpdateManyMutationInput, CharacterMergeAuditUncheckedUpdateManyWithoutBookInput>
  }

  export type CharacterMergeAuditScalarWhereInput = {
    AND?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
    OR?: CharacterMergeAuditScalarWhereInput[]
    NOT?: CharacterMergeAuditScalarWhereInput | CharacterMergeAuditScalarWhereInput[]
    id?: StringFilter<"CharacterMergeAudit"> | string
    bookId?: StringFilter<"CharacterMergeAudit"> | string
    sourceCharacterId?: StringFilter<"CharacterMergeAudit"> | string
    targetCharacterId?: StringFilter<"CharacterMergeAudit"> | string
    mergeReason?: StringNullableFilter<"CharacterMergeAudit"> | string | null
    mergedBy?: StringNullableFilter<"CharacterMergeAudit"> | string | null
    createdAt?: DateTimeFilter<"CharacterMergeAudit"> | Date | string
  }

  export type CharacterProfileUpsertWithWhereUniqueWithoutBookInput = {
    where: CharacterProfileWhereUniqueInput
    update: XOR<CharacterProfileUpdateWithoutBookInput, CharacterProfileUncheckedUpdateWithoutBookInput>
    create: XOR<CharacterProfileCreateWithoutBookInput, CharacterProfileUncheckedCreateWithoutBookInput>
  }

  export type CharacterProfileUpdateWithWhereUniqueWithoutBookInput = {
    where: CharacterProfileWhereUniqueInput
    data: XOR<CharacterProfileUpdateWithoutBookInput, CharacterProfileUncheckedUpdateWithoutBookInput>
  }

  export type CharacterProfileUpdateManyWithWhereWithoutBookInput = {
    where: CharacterProfileScalarWhereInput
    data: XOR<CharacterProfileUpdateManyMutationInput, CharacterProfileUncheckedUpdateManyWithoutBookInput>
  }

  export type CharacterProfileScalarWhereInput = {
    AND?: CharacterProfileScalarWhereInput | CharacterProfileScalarWhereInput[]
    OR?: CharacterProfileScalarWhereInput[]
    NOT?: CharacterProfileScalarWhereInput | CharacterProfileScalarWhereInput[]
    id?: StringFilter<"CharacterProfile"> | string
    bookId?: StringFilter<"CharacterProfile"> | string
    canonicalName?: StringFilter<"CharacterProfile"> | string
    characteristics?: JsonFilter<"CharacterProfile">
    voicePreferences?: JsonFilter<"CharacterProfile">
    emotionProfile?: JsonFilter<"CharacterProfile">
    genderHint?: StringFilter<"CharacterProfile"> | string
    ageHint?: IntNullableFilter<"CharacterProfile"> | number | null
    emotionBaseline?: StringFilter<"CharacterProfile"> | string
    isActive?: BoolFilter<"CharacterProfile"> | boolean
    mentions?: IntNullableFilter<"CharacterProfile"> | number | null
    quotes?: IntNullableFilter<"CharacterProfile"> | number | null
    createdAt?: DateTimeFilter<"CharacterProfile"> | Date | string
    updatedAt?: DateTimeFilter<"CharacterProfile"> | Date | string
  }

  export type ProcessingTaskUpsertWithWhereUniqueWithoutBookInput = {
    where: ProcessingTaskWhereUniqueInput
    update: XOR<ProcessingTaskUpdateWithoutBookInput, ProcessingTaskUncheckedUpdateWithoutBookInput>
    create: XOR<ProcessingTaskCreateWithoutBookInput, ProcessingTaskUncheckedCreateWithoutBookInput>
  }

  export type ProcessingTaskUpdateWithWhereUniqueWithoutBookInput = {
    where: ProcessingTaskWhereUniqueInput
    data: XOR<ProcessingTaskUpdateWithoutBookInput, ProcessingTaskUncheckedUpdateWithoutBookInput>
  }

  export type ProcessingTaskUpdateManyWithWhereWithoutBookInput = {
    where: ProcessingTaskScalarWhereInput
    data: XOR<ProcessingTaskUpdateManyMutationInput, ProcessingTaskUncheckedUpdateManyWithoutBookInput>
  }

  export type ProcessingTaskScalarWhereInput = {
    AND?: ProcessingTaskScalarWhereInput | ProcessingTaskScalarWhereInput[]
    OR?: ProcessingTaskScalarWhereInput[]
    NOT?: ProcessingTaskScalarWhereInput | ProcessingTaskScalarWhereInput[]
    id?: StringFilter<"ProcessingTask"> | string
    bookId?: StringFilter<"ProcessingTask"> | string
    taskType?: StringFilter<"ProcessingTask"> | string
    status?: StringFilter<"ProcessingTask"> | string
    progress?: IntFilter<"ProcessingTask"> | number
    totalItems?: IntFilter<"ProcessingTask"> | number
    processedItems?: IntFilter<"ProcessingTask"> | number
    taskData?: JsonFilter<"ProcessingTask">
    errorMessage?: StringNullableFilter<"ProcessingTask"> | string | null
    externalTaskId?: StringNullableFilter<"ProcessingTask"> | string | null
    startedAt?: DateTimeNullableFilter<"ProcessingTask"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"ProcessingTask"> | Date | string | null
    createdAt?: DateTimeFilter<"ProcessingTask"> | Date | string
    updatedAt?: DateTimeFilter<"ProcessingTask"> | Date | string
  }

  export type ScriptSentenceUpsertWithWhereUniqueWithoutBookInput = {
    where: ScriptSentenceWhereUniqueInput
    update: XOR<ScriptSentenceUpdateWithoutBookInput, ScriptSentenceUncheckedUpdateWithoutBookInput>
    create: XOR<ScriptSentenceCreateWithoutBookInput, ScriptSentenceUncheckedCreateWithoutBookInput>
  }

  export type ScriptSentenceUpdateWithWhereUniqueWithoutBookInput = {
    where: ScriptSentenceWhereUniqueInput
    data: XOR<ScriptSentenceUpdateWithoutBookInput, ScriptSentenceUncheckedUpdateWithoutBookInput>
  }

  export type ScriptSentenceUpdateManyWithWhereWithoutBookInput = {
    where: ScriptSentenceScalarWhereInput
    data: XOR<ScriptSentenceUpdateManyMutationInput, ScriptSentenceUncheckedUpdateManyWithoutBookInput>
  }

  export type ScriptSentenceScalarWhereInput = {
    AND?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
    OR?: ScriptSentenceScalarWhereInput[]
    NOT?: ScriptSentenceScalarWhereInput | ScriptSentenceScalarWhereInput[]
    id?: StringFilter<"ScriptSentence"> | string
    bookId?: StringFilter<"ScriptSentence"> | string
    segmentId?: StringFilter<"ScriptSentence"> | string
    characterId?: StringNullableFilter<"ScriptSentence"> | string | null
    rawSpeaker?: StringNullableFilter<"ScriptSentence"> | string | null
    text?: StringFilter<"ScriptSentence"> | string
    orderInSegment?: IntFilter<"ScriptSentence"> | number
    tone?: StringNullableFilter<"ScriptSentence"> | string | null
    strength?: IntNullableFilter<"ScriptSentence"> | number | null
    pauseAfter?: DecimalNullableFilter<"ScriptSentence"> | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: JsonNullableFilter<"ScriptSentence">
    createdAt?: DateTimeFilter<"ScriptSentence"> | Date | string
  }

  export type TextSegmentUpsertWithWhereUniqueWithoutBookInput = {
    where: TextSegmentWhereUniqueInput
    update: XOR<TextSegmentUpdateWithoutBookInput, TextSegmentUncheckedUpdateWithoutBookInput>
    create: XOR<TextSegmentCreateWithoutBookInput, TextSegmentUncheckedCreateWithoutBookInput>
  }

  export type TextSegmentUpdateWithWhereUniqueWithoutBookInput = {
    where: TextSegmentWhereUniqueInput
    data: XOR<TextSegmentUpdateWithoutBookInput, TextSegmentUncheckedUpdateWithoutBookInput>
  }

  export type TextSegmentUpdateManyWithWhereWithoutBookInput = {
    where: TextSegmentScalarWhereInput
    data: XOR<TextSegmentUpdateManyMutationInput, TextSegmentUncheckedUpdateManyWithoutBookInput>
  }

  export type TextSegmentScalarWhereInput = {
    AND?: TextSegmentScalarWhereInput | TextSegmentScalarWhereInput[]
    OR?: TextSegmentScalarWhereInput[]
    NOT?: TextSegmentScalarWhereInput | TextSegmentScalarWhereInput[]
    id?: StringFilter<"TextSegment"> | string
    bookId?: StringFilter<"TextSegment"> | string
    segmentIndex?: IntFilter<"TextSegment"> | number
    startPosition?: IntFilter<"TextSegment"> | number
    endPosition?: IntFilter<"TextSegment"> | number
    content?: StringFilter<"TextSegment"> | string
    wordCount?: IntNullableFilter<"TextSegment"> | number | null
    segmentType?: StringNullableFilter<"TextSegment"> | string | null
    orderIndex?: IntFilter<"TextSegment"> | number
    metadata?: JsonNullableFilter<"TextSegment">
    status?: StringFilter<"TextSegment"> | string
    createdAt?: DateTimeFilter<"TextSegment"> | Date | string
  }

  export type CharacterAliasCreateWithoutCharacterInput = {
    id?: string
    alias: string
    confidence?: Decimal | DecimalJsLike | number | string
    sourceSentence?: string | null
    createdAt?: Date | string
  }

  export type CharacterAliasUncheckedCreateWithoutCharacterInput = {
    id?: string
    alias: string
    confidence?: Decimal | DecimalJsLike | number | string
    sourceSentence?: string | null
    createdAt?: Date | string
  }

  export type CharacterAliasCreateOrConnectWithoutCharacterInput = {
    where: CharacterAliasWhereUniqueInput
    create: XOR<CharacterAliasCreateWithoutCharacterInput, CharacterAliasUncheckedCreateWithoutCharacterInput>
  }

  export type CharacterAliasCreateManyCharacterInputEnvelope = {
    data: CharacterAliasCreateManyCharacterInput | CharacterAliasCreateManyCharacterInput[]
    skipDuplicates?: boolean
  }

  export type CharacterMergeAuditCreateWithoutSourceCharacterInput = {
    id?: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
    book: BookCreateNestedOneWithoutMergeAuditsInput
    targetCharacter: CharacterProfileCreateNestedOneWithoutMergeAuditsTargetInput
  }

  export type CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput = {
    id?: string
    bookId: string
    targetCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterMergeAuditCreateOrConnectWithoutSourceCharacterInput = {
    where: CharacterMergeAuditWhereUniqueInput
    create: XOR<CharacterMergeAuditCreateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput>
  }

  export type CharacterMergeAuditCreateManySourceCharacterInputEnvelope = {
    data: CharacterMergeAuditCreateManySourceCharacterInput | CharacterMergeAuditCreateManySourceCharacterInput[]
    skipDuplicates?: boolean
  }

  export type CharacterMergeAuditCreateWithoutTargetCharacterInput = {
    id?: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
    book: BookCreateNestedOneWithoutMergeAuditsInput
    sourceCharacter: CharacterProfileCreateNestedOneWithoutMergeAuditsSourceInput
  }

  export type CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput = {
    id?: string
    bookId: string
    sourceCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterMergeAuditCreateOrConnectWithoutTargetCharacterInput = {
    where: CharacterMergeAuditWhereUniqueInput
    create: XOR<CharacterMergeAuditCreateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput>
  }

  export type CharacterMergeAuditCreateManyTargetCharacterInputEnvelope = {
    data: CharacterMergeAuditCreateManyTargetCharacterInput | CharacterMergeAuditCreateManyTargetCharacterInput[]
    skipDuplicates?: boolean
  }

  export type BookCreateWithoutCharacterProfilesInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentCreateNestedManyWithoutBookInput
  }

  export type BookUncheckedCreateWithoutCharacterProfilesInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditUncheckedCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskUncheckedCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentUncheckedCreateNestedManyWithoutBookInput
  }

  export type BookCreateOrConnectWithoutCharacterProfilesInput = {
    where: BookWhereUniqueInput
    create: XOR<BookCreateWithoutCharacterProfilesInput, BookUncheckedCreateWithoutCharacterProfilesInput>
  }

  export type CharacterVoiceBindingCreateWithoutCharacterInput = {
    id?: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    voiceProfile: TTSVoiceProfileCreateNestedOneWithoutVoiceBindingsInput
  }

  export type CharacterVoiceBindingUncheckedCreateWithoutCharacterInput = {
    id?: string
    voiceProfileId: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CharacterVoiceBindingCreateOrConnectWithoutCharacterInput = {
    where: CharacterVoiceBindingWhereUniqueInput
    create: XOR<CharacterVoiceBindingCreateWithoutCharacterInput, CharacterVoiceBindingUncheckedCreateWithoutCharacterInput>
  }

  export type CharacterVoiceBindingCreateManyCharacterInputEnvelope = {
    data: CharacterVoiceBindingCreateManyCharacterInput | CharacterVoiceBindingCreateManyCharacterInput[]
    skipDuplicates?: boolean
  }

  export type ScriptSentenceCreateWithoutCharacterInput = {
    id?: string
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutScriptSentenceInput
    book: BookCreateNestedOneWithoutScriptSentencesInput
    segment: TextSegmentCreateNestedOneWithoutScriptSentencesInput
  }

  export type ScriptSentenceUncheckedCreateWithoutCharacterInput = {
    id?: string
    bookId: string
    segmentId: string
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutScriptSentenceInput
  }

  export type ScriptSentenceCreateOrConnectWithoutCharacterInput = {
    where: ScriptSentenceWhereUniqueInput
    create: XOR<ScriptSentenceCreateWithoutCharacterInput, ScriptSentenceUncheckedCreateWithoutCharacterInput>
  }

  export type ScriptSentenceCreateManyCharacterInputEnvelope = {
    data: ScriptSentenceCreateManyCharacterInput | ScriptSentenceCreateManyCharacterInput[]
    skipDuplicates?: boolean
  }

  export type CharacterAliasUpsertWithWhereUniqueWithoutCharacterInput = {
    where: CharacterAliasWhereUniqueInput
    update: XOR<CharacterAliasUpdateWithoutCharacterInput, CharacterAliasUncheckedUpdateWithoutCharacterInput>
    create: XOR<CharacterAliasCreateWithoutCharacterInput, CharacterAliasUncheckedCreateWithoutCharacterInput>
  }

  export type CharacterAliasUpdateWithWhereUniqueWithoutCharacterInput = {
    where: CharacterAliasWhereUniqueInput
    data: XOR<CharacterAliasUpdateWithoutCharacterInput, CharacterAliasUncheckedUpdateWithoutCharacterInput>
  }

  export type CharacterAliasUpdateManyWithWhereWithoutCharacterInput = {
    where: CharacterAliasScalarWhereInput
    data: XOR<CharacterAliasUpdateManyMutationInput, CharacterAliasUncheckedUpdateManyWithoutCharacterInput>
  }

  export type CharacterAliasScalarWhereInput = {
    AND?: CharacterAliasScalarWhereInput | CharacterAliasScalarWhereInput[]
    OR?: CharacterAliasScalarWhereInput[]
    NOT?: CharacterAliasScalarWhereInput | CharacterAliasScalarWhereInput[]
    id?: StringFilter<"CharacterAlias"> | string
    characterId?: StringFilter<"CharacterAlias"> | string
    alias?: StringFilter<"CharacterAlias"> | string
    confidence?: DecimalFilter<"CharacterAlias"> | Decimal | DecimalJsLike | number | string
    sourceSentence?: StringNullableFilter<"CharacterAlias"> | string | null
    createdAt?: DateTimeFilter<"CharacterAlias"> | Date | string
  }

  export type CharacterMergeAuditUpsertWithWhereUniqueWithoutSourceCharacterInput = {
    where: CharacterMergeAuditWhereUniqueInput
    update: XOR<CharacterMergeAuditUpdateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedUpdateWithoutSourceCharacterInput>
    create: XOR<CharacterMergeAuditCreateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedCreateWithoutSourceCharacterInput>
  }

  export type CharacterMergeAuditUpdateWithWhereUniqueWithoutSourceCharacterInput = {
    where: CharacterMergeAuditWhereUniqueInput
    data: XOR<CharacterMergeAuditUpdateWithoutSourceCharacterInput, CharacterMergeAuditUncheckedUpdateWithoutSourceCharacterInput>
  }

  export type CharacterMergeAuditUpdateManyWithWhereWithoutSourceCharacterInput = {
    where: CharacterMergeAuditScalarWhereInput
    data: XOR<CharacterMergeAuditUpdateManyMutationInput, CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterInput>
  }

  export type CharacterMergeAuditUpsertWithWhereUniqueWithoutTargetCharacterInput = {
    where: CharacterMergeAuditWhereUniqueInput
    update: XOR<CharacterMergeAuditUpdateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedUpdateWithoutTargetCharacterInput>
    create: XOR<CharacterMergeAuditCreateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedCreateWithoutTargetCharacterInput>
  }

  export type CharacterMergeAuditUpdateWithWhereUniqueWithoutTargetCharacterInput = {
    where: CharacterMergeAuditWhereUniqueInput
    data: XOR<CharacterMergeAuditUpdateWithoutTargetCharacterInput, CharacterMergeAuditUncheckedUpdateWithoutTargetCharacterInput>
  }

  export type CharacterMergeAuditUpdateManyWithWhereWithoutTargetCharacterInput = {
    where: CharacterMergeAuditScalarWhereInput
    data: XOR<CharacterMergeAuditUpdateManyMutationInput, CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterInput>
  }

  export type BookUpsertWithoutCharacterProfilesInput = {
    update: XOR<BookUpdateWithoutCharacterProfilesInput, BookUncheckedUpdateWithoutCharacterProfilesInput>
    create: XOR<BookCreateWithoutCharacterProfilesInput, BookUncheckedCreateWithoutCharacterProfilesInput>
    where?: BookWhereInput
  }

  export type BookUpdateToOneWithWhereWithoutCharacterProfilesInput = {
    where?: BookWhereInput
    data: XOR<BookUpdateWithoutCharacterProfilesInput, BookUncheckedUpdateWithoutCharacterProfilesInput>
  }

  export type BookUpdateWithoutCharacterProfilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUpdateManyWithoutBookNestedInput
  }

  export type BookUncheckedUpdateWithoutCharacterProfilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUncheckedUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUncheckedUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUncheckedUpdateManyWithoutBookNestedInput
  }

  export type CharacterVoiceBindingUpsertWithWhereUniqueWithoutCharacterInput = {
    where: CharacterVoiceBindingWhereUniqueInput
    update: XOR<CharacterVoiceBindingUpdateWithoutCharacterInput, CharacterVoiceBindingUncheckedUpdateWithoutCharacterInput>
    create: XOR<CharacterVoiceBindingCreateWithoutCharacterInput, CharacterVoiceBindingUncheckedCreateWithoutCharacterInput>
  }

  export type CharacterVoiceBindingUpdateWithWhereUniqueWithoutCharacterInput = {
    where: CharacterVoiceBindingWhereUniqueInput
    data: XOR<CharacterVoiceBindingUpdateWithoutCharacterInput, CharacterVoiceBindingUncheckedUpdateWithoutCharacterInput>
  }

  export type CharacterVoiceBindingUpdateManyWithWhereWithoutCharacterInput = {
    where: CharacterVoiceBindingScalarWhereInput
    data: XOR<CharacterVoiceBindingUpdateManyMutationInput, CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterInput>
  }

  export type CharacterVoiceBindingScalarWhereInput = {
    AND?: CharacterVoiceBindingScalarWhereInput | CharacterVoiceBindingScalarWhereInput[]
    OR?: CharacterVoiceBindingScalarWhereInput[]
    NOT?: CharacterVoiceBindingScalarWhereInput | CharacterVoiceBindingScalarWhereInput[]
    id?: StringFilter<"CharacterVoiceBinding"> | string
    characterId?: StringFilter<"CharacterVoiceBinding"> | string
    voiceProfileId?: StringFilter<"CharacterVoiceBinding"> | string
    customParameters?: JsonNullableFilter<"CharacterVoiceBinding">
    emotionMappings?: JsonFilter<"CharacterVoiceBinding">
    isDefault?: BoolFilter<"CharacterVoiceBinding"> | boolean
    createdAt?: DateTimeFilter<"CharacterVoiceBinding"> | Date | string
    updatedAt?: DateTimeFilter<"CharacterVoiceBinding"> | Date | string
  }

  export type ScriptSentenceUpsertWithWhereUniqueWithoutCharacterInput = {
    where: ScriptSentenceWhereUniqueInput
    update: XOR<ScriptSentenceUpdateWithoutCharacterInput, ScriptSentenceUncheckedUpdateWithoutCharacterInput>
    create: XOR<ScriptSentenceCreateWithoutCharacterInput, ScriptSentenceUncheckedCreateWithoutCharacterInput>
  }

  export type ScriptSentenceUpdateWithWhereUniqueWithoutCharacterInput = {
    where: ScriptSentenceWhereUniqueInput
    data: XOR<ScriptSentenceUpdateWithoutCharacterInput, ScriptSentenceUncheckedUpdateWithoutCharacterInput>
  }

  export type ScriptSentenceUpdateManyWithWhereWithoutCharacterInput = {
    where: ScriptSentenceScalarWhereInput
    data: XOR<ScriptSentenceUpdateManyMutationInput, ScriptSentenceUncheckedUpdateManyWithoutCharacterInput>
  }

  export type CharacterProfileCreateWithoutAliasesInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    mergeAuditsSource?: CharacterMergeAuditCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditCreateNestedManyWithoutTargetCharacterInput
    book: BookCreateNestedOneWithoutCharacterProfilesInput
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUncheckedCreateWithoutAliasesInput = {
    id?: string
    bookId: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    mergeAuditsSource?: CharacterMergeAuditUncheckedCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedCreateNestedManyWithoutTargetCharacterInput
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileCreateOrConnectWithoutAliasesInput = {
    where: CharacterProfileWhereUniqueInput
    create: XOR<CharacterProfileCreateWithoutAliasesInput, CharacterProfileUncheckedCreateWithoutAliasesInput>
  }

  export type CharacterProfileUpsertWithoutAliasesInput = {
    update: XOR<CharacterProfileUpdateWithoutAliasesInput, CharacterProfileUncheckedUpdateWithoutAliasesInput>
    create: XOR<CharacterProfileCreateWithoutAliasesInput, CharacterProfileUncheckedCreateWithoutAliasesInput>
    where?: CharacterProfileWhereInput
  }

  export type CharacterProfileUpdateToOneWithWhereWithoutAliasesInput = {
    where?: CharacterProfileWhereInput
    data: XOR<CharacterProfileUpdateWithoutAliasesInput, CharacterProfileUncheckedUpdateWithoutAliasesInput>
  }

  export type CharacterProfileUpdateWithoutAliasesInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mergeAuditsSource?: CharacterMergeAuditUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUpdateManyWithoutTargetCharacterNestedInput
    book?: BookUpdateOneRequiredWithoutCharacterProfilesNestedInput
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateWithoutAliasesInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mergeAuditsSource?: CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterNestedInput
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutCharacterNestedInput
  }

  export type AudioFileCreateWithoutVoiceProfileInput = {
    id?: string
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    book: BookCreateNestedOneWithoutAudioFilesInput
    segment?: TextSegmentCreateNestedOneWithoutAudioFilesInput
    scriptSentence?: ScriptSentenceCreateNestedOneWithoutAudioFilesInput
  }

  export type AudioFileUncheckedCreateWithoutVoiceProfileInput = {
    id?: string
    bookId: string
    sentenceId?: string | null
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileCreateOrConnectWithoutVoiceProfileInput = {
    where: AudioFileWhereUniqueInput
    create: XOR<AudioFileCreateWithoutVoiceProfileInput, AudioFileUncheckedCreateWithoutVoiceProfileInput>
  }

  export type AudioFileCreateManyVoiceProfileInputEnvelope = {
    data: AudioFileCreateManyVoiceProfileInput | AudioFileCreateManyVoiceProfileInput[]
    skipDuplicates?: boolean
  }

  export type CharacterVoiceBindingCreateWithoutVoiceProfileInput = {
    id?: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    character: CharacterProfileCreateNestedOneWithoutVoiceBindingsInput
  }

  export type CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput = {
    id?: string
    characterId: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CharacterVoiceBindingCreateOrConnectWithoutVoiceProfileInput = {
    where: CharacterVoiceBindingWhereUniqueInput
    create: XOR<CharacterVoiceBindingCreateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput>
  }

  export type CharacterVoiceBindingCreateManyVoiceProfileInputEnvelope = {
    data: CharacterVoiceBindingCreateManyVoiceProfileInput | CharacterVoiceBindingCreateManyVoiceProfileInput[]
    skipDuplicates?: boolean
  }

  export type AudioFileUpsertWithWhereUniqueWithoutVoiceProfileInput = {
    where: AudioFileWhereUniqueInput
    update: XOR<AudioFileUpdateWithoutVoiceProfileInput, AudioFileUncheckedUpdateWithoutVoiceProfileInput>
    create: XOR<AudioFileCreateWithoutVoiceProfileInput, AudioFileUncheckedCreateWithoutVoiceProfileInput>
  }

  export type AudioFileUpdateWithWhereUniqueWithoutVoiceProfileInput = {
    where: AudioFileWhereUniqueInput
    data: XOR<AudioFileUpdateWithoutVoiceProfileInput, AudioFileUncheckedUpdateWithoutVoiceProfileInput>
  }

  export type AudioFileUpdateManyWithWhereWithoutVoiceProfileInput = {
    where: AudioFileScalarWhereInput
    data: XOR<AudioFileUpdateManyMutationInput, AudioFileUncheckedUpdateManyWithoutVoiceProfileInput>
  }

  export type CharacterVoiceBindingUpsertWithWhereUniqueWithoutVoiceProfileInput = {
    where: CharacterVoiceBindingWhereUniqueInput
    update: XOR<CharacterVoiceBindingUpdateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedUpdateWithoutVoiceProfileInput>
    create: XOR<CharacterVoiceBindingCreateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedCreateWithoutVoiceProfileInput>
  }

  export type CharacterVoiceBindingUpdateWithWhereUniqueWithoutVoiceProfileInput = {
    where: CharacterVoiceBindingWhereUniqueInput
    data: XOR<CharacterVoiceBindingUpdateWithoutVoiceProfileInput, CharacterVoiceBindingUncheckedUpdateWithoutVoiceProfileInput>
  }

  export type CharacterVoiceBindingUpdateManyWithWhereWithoutVoiceProfileInput = {
    where: CharacterVoiceBindingScalarWhereInput
    data: XOR<CharacterVoiceBindingUpdateManyMutationInput, CharacterVoiceBindingUncheckedUpdateManyWithoutVoiceProfileInput>
  }

  export type CharacterProfileCreateWithoutVoiceBindingsInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditCreateNestedManyWithoutTargetCharacterInput
    book: BookCreateNestedOneWithoutCharacterProfilesInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUncheckedCreateWithoutVoiceBindingsInput = {
    id?: string
    bookId: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasUncheckedCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedCreateNestedManyWithoutTargetCharacterInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileCreateOrConnectWithoutVoiceBindingsInput = {
    where: CharacterProfileWhereUniqueInput
    create: XOR<CharacterProfileCreateWithoutVoiceBindingsInput, CharacterProfileUncheckedCreateWithoutVoiceBindingsInput>
  }

  export type TTSVoiceProfileCreateWithoutVoiceBindingsInput = {
    id?: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description?: string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: number
    rating?: Decimal | DecimalJsLike | number | string
    isAvailable?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutVoiceProfileInput
  }

  export type TTSVoiceProfileUncheckedCreateWithoutVoiceBindingsInput = {
    id?: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description?: string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: number
    rating?: Decimal | DecimalJsLike | number | string
    isAvailable?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutVoiceProfileInput
  }

  export type TTSVoiceProfileCreateOrConnectWithoutVoiceBindingsInput = {
    where: TTSVoiceProfileWhereUniqueInput
    create: XOR<TTSVoiceProfileCreateWithoutVoiceBindingsInput, TTSVoiceProfileUncheckedCreateWithoutVoiceBindingsInput>
  }

  export type CharacterProfileUpsertWithoutVoiceBindingsInput = {
    update: XOR<CharacterProfileUpdateWithoutVoiceBindingsInput, CharacterProfileUncheckedUpdateWithoutVoiceBindingsInput>
    create: XOR<CharacterProfileCreateWithoutVoiceBindingsInput, CharacterProfileUncheckedCreateWithoutVoiceBindingsInput>
    where?: CharacterProfileWhereInput
  }

  export type CharacterProfileUpdateToOneWithWhereWithoutVoiceBindingsInput = {
    where?: CharacterProfileWhereInput
    data: XOR<CharacterProfileUpdateWithoutVoiceBindingsInput, CharacterProfileUncheckedUpdateWithoutVoiceBindingsInput>
  }

  export type CharacterProfileUpdateWithoutVoiceBindingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUpdateManyWithoutTargetCharacterNestedInput
    book?: BookUpdateOneRequiredWithoutCharacterProfilesNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateWithoutVoiceBindingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUncheckedUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutCharacterNestedInput
  }

  export type TTSVoiceProfileUpsertWithoutVoiceBindingsInput = {
    update: XOR<TTSVoiceProfileUpdateWithoutVoiceBindingsInput, TTSVoiceProfileUncheckedUpdateWithoutVoiceBindingsInput>
    create: XOR<TTSVoiceProfileCreateWithoutVoiceBindingsInput, TTSVoiceProfileUncheckedCreateWithoutVoiceBindingsInput>
    where?: TTSVoiceProfileWhereInput
  }

  export type TTSVoiceProfileUpdateToOneWithWhereWithoutVoiceBindingsInput = {
    where?: TTSVoiceProfileWhereInput
    data: XOR<TTSVoiceProfileUpdateWithoutVoiceBindingsInput, TTSVoiceProfileUncheckedUpdateWithoutVoiceBindingsInput>
  }

  export type TTSVoiceProfileUpdateWithoutVoiceBindingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutVoiceProfileNestedInput
  }

  export type TTSVoiceProfileUncheckedUpdateWithoutVoiceBindingsInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutVoiceProfileNestedInput
  }

  export type AudioFileCreateWithoutSegmentInput = {
    id?: string
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    book: BookCreateNestedOneWithoutAudioFilesInput
    scriptSentence?: ScriptSentenceCreateNestedOneWithoutAudioFilesInput
    voiceProfile?: TTSVoiceProfileCreateNestedOneWithoutAudioFilesInput
  }

  export type AudioFileUncheckedCreateWithoutSegmentInput = {
    id?: string
    bookId: string
    sentenceId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileCreateOrConnectWithoutSegmentInput = {
    where: AudioFileWhereUniqueInput
    create: XOR<AudioFileCreateWithoutSegmentInput, AudioFileUncheckedCreateWithoutSegmentInput>
  }

  export type AudioFileCreateManySegmentInputEnvelope = {
    data: AudioFileCreateManySegmentInput | AudioFileCreateManySegmentInput[]
    skipDuplicates?: boolean
  }

  export type ScriptSentenceCreateWithoutSegmentInput = {
    id?: string
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutScriptSentenceInput
    book: BookCreateNestedOneWithoutScriptSentencesInput
    character?: CharacterProfileCreateNestedOneWithoutScriptSentencesInput
  }

  export type ScriptSentenceUncheckedCreateWithoutSegmentInput = {
    id?: string
    bookId: string
    characterId?: string | null
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutScriptSentenceInput
  }

  export type ScriptSentenceCreateOrConnectWithoutSegmentInput = {
    where: ScriptSentenceWhereUniqueInput
    create: XOR<ScriptSentenceCreateWithoutSegmentInput, ScriptSentenceUncheckedCreateWithoutSegmentInput>
  }

  export type ScriptSentenceCreateManySegmentInputEnvelope = {
    data: ScriptSentenceCreateManySegmentInput | ScriptSentenceCreateManySegmentInput[]
    skipDuplicates?: boolean
  }

  export type BookCreateWithoutTextSegmentsInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutBookInput
  }

  export type BookUncheckedCreateWithoutTextSegmentsInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditUncheckedCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileUncheckedCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskUncheckedCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutBookInput
  }

  export type BookCreateOrConnectWithoutTextSegmentsInput = {
    where: BookWhereUniqueInput
    create: XOR<BookCreateWithoutTextSegmentsInput, BookUncheckedCreateWithoutTextSegmentsInput>
  }

  export type AudioFileUpsertWithWhereUniqueWithoutSegmentInput = {
    where: AudioFileWhereUniqueInput
    update: XOR<AudioFileUpdateWithoutSegmentInput, AudioFileUncheckedUpdateWithoutSegmentInput>
    create: XOR<AudioFileCreateWithoutSegmentInput, AudioFileUncheckedCreateWithoutSegmentInput>
  }

  export type AudioFileUpdateWithWhereUniqueWithoutSegmentInput = {
    where: AudioFileWhereUniqueInput
    data: XOR<AudioFileUpdateWithoutSegmentInput, AudioFileUncheckedUpdateWithoutSegmentInput>
  }

  export type AudioFileUpdateManyWithWhereWithoutSegmentInput = {
    where: AudioFileScalarWhereInput
    data: XOR<AudioFileUpdateManyMutationInput, AudioFileUncheckedUpdateManyWithoutSegmentInput>
  }

  export type ScriptSentenceUpsertWithWhereUniqueWithoutSegmentInput = {
    where: ScriptSentenceWhereUniqueInput
    update: XOR<ScriptSentenceUpdateWithoutSegmentInput, ScriptSentenceUncheckedUpdateWithoutSegmentInput>
    create: XOR<ScriptSentenceCreateWithoutSegmentInput, ScriptSentenceUncheckedCreateWithoutSegmentInput>
  }

  export type ScriptSentenceUpdateWithWhereUniqueWithoutSegmentInput = {
    where: ScriptSentenceWhereUniqueInput
    data: XOR<ScriptSentenceUpdateWithoutSegmentInput, ScriptSentenceUncheckedUpdateWithoutSegmentInput>
  }

  export type ScriptSentenceUpdateManyWithWhereWithoutSegmentInput = {
    where: ScriptSentenceScalarWhereInput
    data: XOR<ScriptSentenceUpdateManyMutationInput, ScriptSentenceUncheckedUpdateManyWithoutSegmentInput>
  }

  export type BookUpsertWithoutTextSegmentsInput = {
    update: XOR<BookUpdateWithoutTextSegmentsInput, BookUncheckedUpdateWithoutTextSegmentsInput>
    create: XOR<BookCreateWithoutTextSegmentsInput, BookUncheckedCreateWithoutTextSegmentsInput>
    where?: BookWhereInput
  }

  export type BookUpdateToOneWithWhereWithoutTextSegmentsInput = {
    where?: BookWhereInput
    data: XOR<BookUpdateWithoutTextSegmentsInput, BookUncheckedUpdateWithoutTextSegmentsInput>
  }

  export type BookUpdateWithoutTextSegmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutBookNestedInput
  }

  export type BookUncheckedUpdateWithoutTextSegmentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUncheckedUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUncheckedUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUncheckedUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutBookNestedInput
  }

  export type AudioFileCreateWithoutScriptSentenceInput = {
    id?: string
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    book: BookCreateNestedOneWithoutAudioFilesInput
    segment?: TextSegmentCreateNestedOneWithoutAudioFilesInput
    voiceProfile?: TTSVoiceProfileCreateNestedOneWithoutAudioFilesInput
  }

  export type AudioFileUncheckedCreateWithoutScriptSentenceInput = {
    id?: string
    bookId: string
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileCreateOrConnectWithoutScriptSentenceInput = {
    where: AudioFileWhereUniqueInput
    create: XOR<AudioFileCreateWithoutScriptSentenceInput, AudioFileUncheckedCreateWithoutScriptSentenceInput>
  }

  export type AudioFileCreateManyScriptSentenceInputEnvelope = {
    data: AudioFileCreateManyScriptSentenceInput | AudioFileCreateManyScriptSentenceInput[]
    skipDuplicates?: boolean
  }

  export type BookCreateWithoutScriptSentencesInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentCreateNestedManyWithoutBookInput
  }

  export type BookUncheckedCreateWithoutScriptSentencesInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditUncheckedCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileUncheckedCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskUncheckedCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentUncheckedCreateNestedManyWithoutBookInput
  }

  export type BookCreateOrConnectWithoutScriptSentencesInput = {
    where: BookWhereUniqueInput
    create: XOR<BookCreateWithoutScriptSentencesInput, BookUncheckedCreateWithoutScriptSentencesInput>
  }

  export type CharacterProfileCreateWithoutScriptSentencesInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditCreateNestedManyWithoutTargetCharacterInput
    book: BookCreateNestedOneWithoutCharacterProfilesInput
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUncheckedCreateWithoutScriptSentencesInput = {
    id?: string
    bookId: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasUncheckedCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedCreateNestedManyWithoutSourceCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedCreateNestedManyWithoutTargetCharacterInput
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileCreateOrConnectWithoutScriptSentencesInput = {
    where: CharacterProfileWhereUniqueInput
    create: XOR<CharacterProfileCreateWithoutScriptSentencesInput, CharacterProfileUncheckedCreateWithoutScriptSentencesInput>
  }

  export type TextSegmentCreateWithoutScriptSentencesInput = {
    id?: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutSegmentInput
    book: BookCreateNestedOneWithoutTextSegmentsInput
  }

  export type TextSegmentUncheckedCreateWithoutScriptSentencesInput = {
    id?: string
    bookId: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutSegmentInput
  }

  export type TextSegmentCreateOrConnectWithoutScriptSentencesInput = {
    where: TextSegmentWhereUniqueInput
    create: XOR<TextSegmentCreateWithoutScriptSentencesInput, TextSegmentUncheckedCreateWithoutScriptSentencesInput>
  }

  export type AudioFileUpsertWithWhereUniqueWithoutScriptSentenceInput = {
    where: AudioFileWhereUniqueInput
    update: XOR<AudioFileUpdateWithoutScriptSentenceInput, AudioFileUncheckedUpdateWithoutScriptSentenceInput>
    create: XOR<AudioFileCreateWithoutScriptSentenceInput, AudioFileUncheckedCreateWithoutScriptSentenceInput>
  }

  export type AudioFileUpdateWithWhereUniqueWithoutScriptSentenceInput = {
    where: AudioFileWhereUniqueInput
    data: XOR<AudioFileUpdateWithoutScriptSentenceInput, AudioFileUncheckedUpdateWithoutScriptSentenceInput>
  }

  export type AudioFileUpdateManyWithWhereWithoutScriptSentenceInput = {
    where: AudioFileScalarWhereInput
    data: XOR<AudioFileUpdateManyMutationInput, AudioFileUncheckedUpdateManyWithoutScriptSentenceInput>
  }

  export type BookUpsertWithoutScriptSentencesInput = {
    update: XOR<BookUpdateWithoutScriptSentencesInput, BookUncheckedUpdateWithoutScriptSentencesInput>
    create: XOR<BookCreateWithoutScriptSentencesInput, BookUncheckedCreateWithoutScriptSentencesInput>
    where?: BookWhereInput
  }

  export type BookUpdateToOneWithWhereWithoutScriptSentencesInput = {
    where?: BookWhereInput
    data: XOR<BookUpdateWithoutScriptSentencesInput, BookUncheckedUpdateWithoutScriptSentencesInput>
  }

  export type BookUpdateWithoutScriptSentencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUpdateManyWithoutBookNestedInput
  }

  export type BookUncheckedUpdateWithoutScriptSentencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUncheckedUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUncheckedUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUncheckedUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUncheckedUpdateManyWithoutBookNestedInput
  }

  export type CharacterProfileUpsertWithoutScriptSentencesInput = {
    update: XOR<CharacterProfileUpdateWithoutScriptSentencesInput, CharacterProfileUncheckedUpdateWithoutScriptSentencesInput>
    create: XOR<CharacterProfileCreateWithoutScriptSentencesInput, CharacterProfileUncheckedCreateWithoutScriptSentencesInput>
    where?: CharacterProfileWhereInput
  }

  export type CharacterProfileUpdateToOneWithWhereWithoutScriptSentencesInput = {
    where?: CharacterProfileWhereInput
    data: XOR<CharacterProfileUpdateWithoutScriptSentencesInput, CharacterProfileUncheckedUpdateWithoutScriptSentencesInput>
  }

  export type CharacterProfileUpdateWithoutScriptSentencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUpdateManyWithoutTargetCharacterNestedInput
    book?: BookUpdateOneRequiredWithoutCharacterProfilesNestedInput
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateWithoutScriptSentencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUncheckedUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterNestedInput
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterNestedInput
  }

  export type TextSegmentUpsertWithoutScriptSentencesInput = {
    update: XOR<TextSegmentUpdateWithoutScriptSentencesInput, TextSegmentUncheckedUpdateWithoutScriptSentencesInput>
    create: XOR<TextSegmentCreateWithoutScriptSentencesInput, TextSegmentUncheckedCreateWithoutScriptSentencesInput>
    where?: TextSegmentWhereInput
  }

  export type TextSegmentUpdateToOneWithWhereWithoutScriptSentencesInput = {
    where?: TextSegmentWhereInput
    data: XOR<TextSegmentUpdateWithoutScriptSentencesInput, TextSegmentUncheckedUpdateWithoutScriptSentencesInput>
  }

  export type TextSegmentUpdateWithoutScriptSentencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutSegmentNestedInput
    book?: BookUpdateOneRequiredWithoutTextSegmentsNestedInput
  }

  export type TextSegmentUncheckedUpdateWithoutScriptSentencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutSegmentNestedInput
  }

  export type BookCreateWithoutAudioFilesInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    mergeAudits?: CharacterMergeAuditCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentCreateNestedManyWithoutBookInput
  }

  export type BookUncheckedCreateWithoutAudioFilesInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    mergeAudits?: CharacterMergeAuditUncheckedCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileUncheckedCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskUncheckedCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentUncheckedCreateNestedManyWithoutBookInput
  }

  export type BookCreateOrConnectWithoutAudioFilesInput = {
    where: BookWhereUniqueInput
    create: XOR<BookCreateWithoutAudioFilesInput, BookUncheckedCreateWithoutAudioFilesInput>
  }

  export type TextSegmentCreateWithoutAudioFilesInput = {
    id?: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutSegmentInput
    book: BookCreateNestedOneWithoutTextSegmentsInput
  }

  export type TextSegmentUncheckedCreateWithoutAudioFilesInput = {
    id?: string
    bookId: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutSegmentInput
  }

  export type TextSegmentCreateOrConnectWithoutAudioFilesInput = {
    where: TextSegmentWhereUniqueInput
    create: XOR<TextSegmentCreateWithoutAudioFilesInput, TextSegmentUncheckedCreateWithoutAudioFilesInput>
  }

  export type ScriptSentenceCreateWithoutAudioFilesInput = {
    id?: string
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    book: BookCreateNestedOneWithoutScriptSentencesInput
    character?: CharacterProfileCreateNestedOneWithoutScriptSentencesInput
    segment: TextSegmentCreateNestedOneWithoutScriptSentencesInput
  }

  export type ScriptSentenceUncheckedCreateWithoutAudioFilesInput = {
    id?: string
    bookId: string
    segmentId: string
    characterId?: string | null
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type ScriptSentenceCreateOrConnectWithoutAudioFilesInput = {
    where: ScriptSentenceWhereUniqueInput
    create: XOR<ScriptSentenceCreateWithoutAudioFilesInput, ScriptSentenceUncheckedCreateWithoutAudioFilesInput>
  }

  export type TTSVoiceProfileCreateWithoutAudioFilesInput = {
    id?: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description?: string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: number
    rating?: Decimal | DecimalJsLike | number | string
    isAvailable?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutVoiceProfileInput
  }

  export type TTSVoiceProfileUncheckedCreateWithoutAudioFilesInput = {
    id?: string
    provider: string
    voiceId: string
    voiceName: string
    displayName: string
    description?: string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: number
    rating?: Decimal | DecimalJsLike | number | string
    isAvailable?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutVoiceProfileInput
  }

  export type TTSVoiceProfileCreateOrConnectWithoutAudioFilesInput = {
    where: TTSVoiceProfileWhereUniqueInput
    create: XOR<TTSVoiceProfileCreateWithoutAudioFilesInput, TTSVoiceProfileUncheckedCreateWithoutAudioFilesInput>
  }

  export type BookUpsertWithoutAudioFilesInput = {
    update: XOR<BookUpdateWithoutAudioFilesInput, BookUncheckedUpdateWithoutAudioFilesInput>
    create: XOR<BookCreateWithoutAudioFilesInput, BookUncheckedCreateWithoutAudioFilesInput>
    where?: BookWhereInput
  }

  export type BookUpdateToOneWithWhereWithoutAudioFilesInput = {
    where?: BookWhereInput
    data: XOR<BookUpdateWithoutAudioFilesInput, BookUncheckedUpdateWithoutAudioFilesInput>
  }

  export type BookUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mergeAudits?: CharacterMergeAuditUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUpdateManyWithoutBookNestedInput
  }

  export type BookUncheckedUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    mergeAudits?: CharacterMergeAuditUncheckedUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUncheckedUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUncheckedUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUncheckedUpdateManyWithoutBookNestedInput
  }

  export type TextSegmentUpsertWithoutAudioFilesInput = {
    update: XOR<TextSegmentUpdateWithoutAudioFilesInput, TextSegmentUncheckedUpdateWithoutAudioFilesInput>
    create: XOR<TextSegmentCreateWithoutAudioFilesInput, TextSegmentUncheckedCreateWithoutAudioFilesInput>
    where?: TextSegmentWhereInput
  }

  export type TextSegmentUpdateToOneWithWhereWithoutAudioFilesInput = {
    where?: TextSegmentWhereInput
    data: XOR<TextSegmentUpdateWithoutAudioFilesInput, TextSegmentUncheckedUpdateWithoutAudioFilesInput>
  }

  export type TextSegmentUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scriptSentences?: ScriptSentenceUpdateManyWithoutSegmentNestedInput
    book?: BookUpdateOneRequiredWithoutTextSegmentsNestedInput
  }

  export type TextSegmentUncheckedUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutSegmentNestedInput
  }

  export type ScriptSentenceUpsertWithoutAudioFilesInput = {
    update: XOR<ScriptSentenceUpdateWithoutAudioFilesInput, ScriptSentenceUncheckedUpdateWithoutAudioFilesInput>
    create: XOR<ScriptSentenceCreateWithoutAudioFilesInput, ScriptSentenceUncheckedCreateWithoutAudioFilesInput>
    where?: ScriptSentenceWhereInput
  }

  export type ScriptSentenceUpdateToOneWithWhereWithoutAudioFilesInput = {
    where?: ScriptSentenceWhereInput
    data: XOR<ScriptSentenceUpdateWithoutAudioFilesInput, ScriptSentenceUncheckedUpdateWithoutAudioFilesInput>
  }

  export type ScriptSentenceUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutScriptSentencesNestedInput
    character?: CharacterProfileUpdateOneWithoutScriptSentencesNestedInput
    segment?: TextSegmentUpdateOneRequiredWithoutScriptSentencesNestedInput
  }

  export type ScriptSentenceUncheckedUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentId?: StringFieldUpdateOperationsInput | string
    characterId?: NullableStringFieldUpdateOperationsInput | string | null
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TTSVoiceProfileUpsertWithoutAudioFilesInput = {
    update: XOR<TTSVoiceProfileUpdateWithoutAudioFilesInput, TTSVoiceProfileUncheckedUpdateWithoutAudioFilesInput>
    create: XOR<TTSVoiceProfileCreateWithoutAudioFilesInput, TTSVoiceProfileUncheckedCreateWithoutAudioFilesInput>
    where?: TTSVoiceProfileWhereInput
  }

  export type TTSVoiceProfileUpdateToOneWithWhereWithoutAudioFilesInput = {
    where?: TTSVoiceProfileWhereInput
    data: XOR<TTSVoiceProfileUpdateWithoutAudioFilesInput, TTSVoiceProfileUncheckedUpdateWithoutAudioFilesInput>
  }

  export type TTSVoiceProfileUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutVoiceProfileNestedInput
  }

  export type TTSVoiceProfileUncheckedUpdateWithoutAudioFilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    provider?: StringFieldUpdateOperationsInput | string
    voiceId?: StringFieldUpdateOperationsInput | string
    voiceName?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    characteristics?: JsonNullValueInput | InputJsonValue
    defaultParameters?: JsonNullValueInput | InputJsonValue
    previewAudio?: NullableJsonNullValueInput | InputJsonValue
    usageCount?: IntFieldUpdateOperationsInput | number
    rating?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    isAvailable?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutVoiceProfileNestedInput
  }

  export type BookCreateWithoutMergeAuditsInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentCreateNestedManyWithoutBookInput
  }

  export type BookUncheckedCreateWithoutMergeAuditsInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileUncheckedCreateNestedManyWithoutBookInput
    processingTasks?: ProcessingTaskUncheckedCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentUncheckedCreateNestedManyWithoutBookInput
  }

  export type BookCreateOrConnectWithoutMergeAuditsInput = {
    where: BookWhereUniqueInput
    create: XOR<BookCreateWithoutMergeAuditsInput, BookUncheckedCreateWithoutMergeAuditsInput>
  }

  export type CharacterProfileCreateWithoutMergeAuditsSourceInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasCreateNestedManyWithoutCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditCreateNestedManyWithoutTargetCharacterInput
    book: BookCreateNestedOneWithoutCharacterProfilesInput
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUncheckedCreateWithoutMergeAuditsSourceInput = {
    id?: string
    bookId: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasUncheckedCreateNestedManyWithoutCharacterInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedCreateNestedManyWithoutTargetCharacterInput
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileCreateOrConnectWithoutMergeAuditsSourceInput = {
    where: CharacterProfileWhereUniqueInput
    create: XOR<CharacterProfileCreateWithoutMergeAuditsSourceInput, CharacterProfileUncheckedCreateWithoutMergeAuditsSourceInput>
  }

  export type CharacterProfileCreateWithoutMergeAuditsTargetInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditCreateNestedManyWithoutSourceCharacterInput
    book: BookCreateNestedOneWithoutCharacterProfilesInput
    voiceBindings?: CharacterVoiceBindingCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileUncheckedCreateWithoutMergeAuditsTargetInput = {
    id?: string
    bookId: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    aliases?: CharacterAliasUncheckedCreateNestedManyWithoutCharacterInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedCreateNestedManyWithoutSourceCharacterInput
    voiceBindings?: CharacterVoiceBindingUncheckedCreateNestedManyWithoutCharacterInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutCharacterInput
  }

  export type CharacterProfileCreateOrConnectWithoutMergeAuditsTargetInput = {
    where: CharacterProfileWhereUniqueInput
    create: XOR<CharacterProfileCreateWithoutMergeAuditsTargetInput, CharacterProfileUncheckedCreateWithoutMergeAuditsTargetInput>
  }

  export type BookUpsertWithoutMergeAuditsInput = {
    update: XOR<BookUpdateWithoutMergeAuditsInput, BookUncheckedUpdateWithoutMergeAuditsInput>
    create: XOR<BookCreateWithoutMergeAuditsInput, BookUncheckedCreateWithoutMergeAuditsInput>
    where?: BookWhereInput
  }

  export type BookUpdateToOneWithWhereWithoutMergeAuditsInput = {
    where?: BookWhereInput
    data: XOR<BookUpdateWithoutMergeAuditsInput, BookUncheckedUpdateWithoutMergeAuditsInput>
  }

  export type BookUpdateWithoutMergeAuditsInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUpdateManyWithoutBookNestedInput
  }

  export type BookUncheckedUpdateWithoutMergeAuditsInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUncheckedUpdateManyWithoutBookNestedInput
    processingTasks?: ProcessingTaskUncheckedUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUncheckedUpdateManyWithoutBookNestedInput
  }

  export type CharacterProfileUpsertWithoutMergeAuditsSourceInput = {
    update: XOR<CharacterProfileUpdateWithoutMergeAuditsSourceInput, CharacterProfileUncheckedUpdateWithoutMergeAuditsSourceInput>
    create: XOR<CharacterProfileCreateWithoutMergeAuditsSourceInput, CharacterProfileUncheckedCreateWithoutMergeAuditsSourceInput>
    where?: CharacterProfileWhereInput
  }

  export type CharacterProfileUpdateToOneWithWhereWithoutMergeAuditsSourceInput = {
    where?: CharacterProfileWhereInput
    data: XOR<CharacterProfileUpdateWithoutMergeAuditsSourceInput, CharacterProfileUncheckedUpdateWithoutMergeAuditsSourceInput>
  }

  export type CharacterProfileUpdateWithoutMergeAuditsSourceInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUpdateManyWithoutCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUpdateManyWithoutTargetCharacterNestedInput
    book?: BookUpdateOneRequiredWithoutCharacterProfilesNestedInput
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateWithoutMergeAuditsSourceInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUncheckedUpdateManyWithoutCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterNestedInput
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUpsertWithoutMergeAuditsTargetInput = {
    update: XOR<CharacterProfileUpdateWithoutMergeAuditsTargetInput, CharacterProfileUncheckedUpdateWithoutMergeAuditsTargetInput>
    create: XOR<CharacterProfileCreateWithoutMergeAuditsTargetInput, CharacterProfileUncheckedCreateWithoutMergeAuditsTargetInput>
    where?: CharacterProfileWhereInput
  }

  export type CharacterProfileUpdateToOneWithWhereWithoutMergeAuditsTargetInput = {
    where?: CharacterProfileWhereInput
    data: XOR<CharacterProfileUpdateWithoutMergeAuditsTargetInput, CharacterProfileUncheckedUpdateWithoutMergeAuditsTargetInput>
  }

  export type CharacterProfileUpdateWithoutMergeAuditsTargetInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUpdateManyWithoutSourceCharacterNestedInput
    book?: BookUpdateOneRequiredWithoutCharacterProfilesNestedInput
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateWithoutMergeAuditsTargetInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUncheckedUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterNestedInput
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutCharacterNestedInput
  }

  export type BookCreateWithoutProcessingTasksInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentCreateNestedManyWithoutBookInput
  }

  export type BookUncheckedCreateWithoutProcessingTasksInput = {
    id?: string
    title: string
    author?: string | null
    originalFilename?: string | null
    uploadedFilePath?: string | null
    fileSize?: bigint | number | null
    totalWords?: number | null
    totalCharacters?: number
    totalSegments?: number
    encoding?: string | null
    fileFormat?: string | null
    status?: string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    audioFiles?: AudioFileUncheckedCreateNestedManyWithoutBookInput
    mergeAudits?: CharacterMergeAuditUncheckedCreateNestedManyWithoutBookInput
    characterProfiles?: CharacterProfileUncheckedCreateNestedManyWithoutBookInput
    scriptSentences?: ScriptSentenceUncheckedCreateNestedManyWithoutBookInput
    textSegments?: TextSegmentUncheckedCreateNestedManyWithoutBookInput
  }

  export type BookCreateOrConnectWithoutProcessingTasksInput = {
    where: BookWhereUniqueInput
    create: XOR<BookCreateWithoutProcessingTasksInput, BookUncheckedCreateWithoutProcessingTasksInput>
  }

  export type BookUpsertWithoutProcessingTasksInput = {
    update: XOR<BookUpdateWithoutProcessingTasksInput, BookUncheckedUpdateWithoutProcessingTasksInput>
    create: XOR<BookCreateWithoutProcessingTasksInput, BookUncheckedCreateWithoutProcessingTasksInput>
    where?: BookWhereInput
  }

  export type BookUpdateToOneWithWhereWithoutProcessingTasksInput = {
    where?: BookWhereInput
    data: XOR<BookUpdateWithoutProcessingTasksInput, BookUncheckedUpdateWithoutProcessingTasksInput>
  }

  export type BookUpdateWithoutProcessingTasksInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUpdateManyWithoutBookNestedInput
  }

  export type BookUncheckedUpdateWithoutProcessingTasksInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    author?: NullableStringFieldUpdateOperationsInput | string | null
    originalFilename?: NullableStringFieldUpdateOperationsInput | string | null
    uploadedFilePath?: NullableStringFieldUpdateOperationsInput | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    totalWords?: NullableIntFieldUpdateOperationsInput | number | null
    totalCharacters?: IntFieldUpdateOperationsInput | number
    totalSegments?: IntFieldUpdateOperationsInput | number
    encoding?: NullableStringFieldUpdateOperationsInput | string | null
    fileFormat?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    metadata?: JsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutBookNestedInput
    mergeAudits?: CharacterMergeAuditUncheckedUpdateManyWithoutBookNestedInput
    characterProfiles?: CharacterProfileUncheckedUpdateManyWithoutBookNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutBookNestedInput
    textSegments?: TextSegmentUncheckedUpdateManyWithoutBookNestedInput
  }

  export type AudioFileCreateManyBookInput = {
    id?: string
    sentenceId?: string | null
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CharacterMergeAuditCreateManyBookInput = {
    id?: string
    sourceCharacterId: string
    targetCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterProfileCreateManyBookInput = {
    id?: string
    canonicalName: string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: string
    ageHint?: number | null
    emotionBaseline?: string
    isActive?: boolean
    mentions?: number | null
    quotes?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ProcessingTaskCreateManyBookInput = {
    id?: string
    taskType: string
    status?: string
    progress?: number
    totalItems?: number
    processedItems?: number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: string | null
    externalTaskId?: string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ScriptSentenceCreateManyBookInput = {
    id?: string
    segmentId: string
    characterId?: string | null
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type TextSegmentCreateManyBookInput = {
    id?: string
    segmentIndex: number
    startPosition: number
    endPosition: number
    content: string
    wordCount?: number | null
    segmentType?: string | null
    orderIndex: number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
  }

  export type AudioFileUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    segment?: TextSegmentUpdateOneWithoutAudioFilesNestedInput
    scriptSentence?: ScriptSentenceUpdateOneWithoutAudioFilesNestedInput
    voiceProfile?: TTSVoiceProfileUpdateOneWithoutAudioFilesNestedInput
  }

  export type AudioFileUncheckedUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileUncheckedUpdateManyWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sourceCharacter?: CharacterProfileUpdateOneRequiredWithoutMergeAuditsSourceNestedInput
    targetCharacter?: CharacterProfileUpdateOneRequiredWithoutMergeAuditsTargetNestedInput
  }

  export type CharacterMergeAuditUncheckedUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceCharacterId?: StringFieldUpdateOperationsInput | string
    targetCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditUncheckedUpdateManyWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    sourceCharacterId?: StringFieldUpdateOperationsInput | string
    targetCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterProfileUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUpdateManyWithoutTargetCharacterNestedInput
    voiceBindings?: CharacterVoiceBindingUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    aliases?: CharacterAliasUncheckedUpdateManyWithoutCharacterNestedInput
    mergeAuditsSource?: CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterNestedInput
    mergeAuditsTarget?: CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterNestedInput
    voiceBindings?: CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutCharacterNestedInput
  }

  export type CharacterProfileUncheckedUpdateManyWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    canonicalName?: StringFieldUpdateOperationsInput | string
    characteristics?: JsonNullValueInput | InputJsonValue
    voicePreferences?: JsonNullValueInput | InputJsonValue
    emotionProfile?: JsonNullValueInput | InputJsonValue
    genderHint?: StringFieldUpdateOperationsInput | string
    ageHint?: NullableIntFieldUpdateOperationsInput | number | null
    emotionBaseline?: StringFieldUpdateOperationsInput | string
    isActive?: BoolFieldUpdateOperationsInput | boolean
    mentions?: NullableIntFieldUpdateOperationsInput | number | null
    quotes?: NullableIntFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProcessingTaskUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    taskType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    progress?: IntFieldUpdateOperationsInput | number
    totalItems?: IntFieldUpdateOperationsInput | number
    processedItems?: IntFieldUpdateOperationsInput | number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    externalTaskId?: NullableStringFieldUpdateOperationsInput | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProcessingTaskUncheckedUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    taskType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    progress?: IntFieldUpdateOperationsInput | number
    totalItems?: IntFieldUpdateOperationsInput | number
    processedItems?: IntFieldUpdateOperationsInput | number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    externalTaskId?: NullableStringFieldUpdateOperationsInput | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProcessingTaskUncheckedUpdateManyWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    taskType?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    progress?: IntFieldUpdateOperationsInput | number
    totalItems?: IntFieldUpdateOperationsInput | number
    processedItems?: IntFieldUpdateOperationsInput | number
    taskData?: JsonNullValueInput | InputJsonValue
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    externalTaskId?: NullableStringFieldUpdateOperationsInput | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ScriptSentenceUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutScriptSentenceNestedInput
    character?: CharacterProfileUpdateOneWithoutScriptSentencesNestedInput
    segment?: TextSegmentUpdateOneRequiredWithoutScriptSentencesNestedInput
  }

  export type ScriptSentenceUncheckedUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentId?: StringFieldUpdateOperationsInput | string
    characterId?: NullableStringFieldUpdateOperationsInput | string | null
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutScriptSentenceNestedInput
  }

  export type ScriptSentenceUncheckedUpdateManyWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentId?: StringFieldUpdateOperationsInput | string
    characterId?: NullableStringFieldUpdateOperationsInput | string | null
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TextSegmentUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutSegmentNestedInput
    scriptSentences?: ScriptSentenceUpdateManyWithoutSegmentNestedInput
  }

  export type TextSegmentUncheckedUpdateWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutSegmentNestedInput
    scriptSentences?: ScriptSentenceUncheckedUpdateManyWithoutSegmentNestedInput
  }

  export type TextSegmentUncheckedUpdateManyWithoutBookInput = {
    id?: StringFieldUpdateOperationsInput | string
    segmentIndex?: IntFieldUpdateOperationsInput | number
    startPosition?: IntFieldUpdateOperationsInput | number
    endPosition?: IntFieldUpdateOperationsInput | number
    content?: StringFieldUpdateOperationsInput | string
    wordCount?: NullableIntFieldUpdateOperationsInput | number | null
    segmentType?: NullableStringFieldUpdateOperationsInput | string | null
    orderIndex?: IntFieldUpdateOperationsInput | number
    metadata?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterAliasCreateManyCharacterInput = {
    id?: string
    alias: string
    confidence?: Decimal | DecimalJsLike | number | string
    sourceSentence?: string | null
    createdAt?: Date | string
  }

  export type CharacterMergeAuditCreateManySourceCharacterInput = {
    id?: string
    bookId: string
    targetCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterMergeAuditCreateManyTargetCharacterInput = {
    id?: string
    bookId: string
    sourceCharacterId: string
    mergeReason?: string | null
    mergedBy?: string | null
    createdAt?: Date | string
  }

  export type CharacterVoiceBindingCreateManyCharacterInput = {
    id?: string
    voiceProfileId: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ScriptSentenceCreateManyCharacterInput = {
    id?: string
    bookId: string
    segmentId: string
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type CharacterAliasUpdateWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    alias?: StringFieldUpdateOperationsInput | string
    confidence?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sourceSentence?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterAliasUncheckedUpdateWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    alias?: StringFieldUpdateOperationsInput | string
    confidence?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sourceSentence?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterAliasUncheckedUpdateManyWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    alias?: StringFieldUpdateOperationsInput | string
    confidence?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sourceSentence?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditUpdateWithoutSourceCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutMergeAuditsNestedInput
    targetCharacter?: CharacterProfileUpdateOneRequiredWithoutMergeAuditsTargetNestedInput
  }

  export type CharacterMergeAuditUncheckedUpdateWithoutSourceCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    targetCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditUncheckedUpdateManyWithoutSourceCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    targetCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditUpdateWithoutTargetCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutMergeAuditsNestedInput
    sourceCharacter?: CharacterProfileUpdateOneRequiredWithoutMergeAuditsSourceNestedInput
  }

  export type CharacterMergeAuditUncheckedUpdateWithoutTargetCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sourceCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterMergeAuditUncheckedUpdateManyWithoutTargetCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sourceCharacterId?: StringFieldUpdateOperationsInput | string
    mergeReason?: NullableStringFieldUpdateOperationsInput | string | null
    mergedBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterVoiceBindingUpdateWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    voiceProfile?: TTSVoiceProfileUpdateOneRequiredWithoutVoiceBindingsNestedInput
  }

  export type CharacterVoiceBindingUncheckedUpdateWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    voiceProfileId?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterVoiceBindingUncheckedUpdateManyWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    voiceProfileId?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ScriptSentenceUpdateWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutScriptSentenceNestedInput
    book?: BookUpdateOneRequiredWithoutScriptSentencesNestedInput
    segment?: TextSegmentUpdateOneRequiredWithoutScriptSentencesNestedInput
  }

  export type ScriptSentenceUncheckedUpdateWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentId?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutScriptSentenceNestedInput
  }

  export type ScriptSentenceUncheckedUpdateManyWithoutCharacterInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentId?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileCreateManyVoiceProfileInput = {
    id?: string
    bookId: string
    sentenceId?: string | null
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CharacterVoiceBindingCreateManyVoiceProfileInput = {
    id?: string
    characterId: string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: boolean
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileUpdateWithoutVoiceProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutAudioFilesNestedInput
    segment?: TextSegmentUpdateOneWithoutAudioFilesNestedInput
    scriptSentence?: ScriptSentenceUpdateOneWithoutAudioFilesNestedInput
  }

  export type AudioFileUncheckedUpdateWithoutVoiceProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileUncheckedUpdateManyWithoutVoiceProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterVoiceBindingUpdateWithoutVoiceProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    character?: CharacterProfileUpdateOneRequiredWithoutVoiceBindingsNestedInput
  }

  export type CharacterVoiceBindingUncheckedUpdateWithoutVoiceProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    characterId?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CharacterVoiceBindingUncheckedUpdateManyWithoutVoiceProfileInput = {
    id?: StringFieldUpdateOperationsInput | string
    characterId?: StringFieldUpdateOperationsInput | string
    customParameters?: NullableJsonNullValueInput | InputJsonValue
    emotionMappings?: JsonNullValueInput | InputJsonValue
    isDefault?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileCreateManySegmentInput = {
    id?: string
    bookId: string
    sentenceId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ScriptSentenceCreateManySegmentInput = {
    id?: string
    bookId: string
    characterId?: string | null
    rawSpeaker?: string | null
    text: string
    orderInSegment: number
    tone?: string | null
    strength?: number | null
    pauseAfter?: Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type AudioFileUpdateWithoutSegmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutAudioFilesNestedInput
    scriptSentence?: ScriptSentenceUpdateOneWithoutAudioFilesNestedInput
    voiceProfile?: TTSVoiceProfileUpdateOneWithoutAudioFilesNestedInput
  }

  export type AudioFileUncheckedUpdateWithoutSegmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileUncheckedUpdateManyWithoutSegmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    sentenceId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ScriptSentenceUpdateWithoutSegmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUpdateManyWithoutScriptSentenceNestedInput
    book?: BookUpdateOneRequiredWithoutScriptSentencesNestedInput
    character?: CharacterProfileUpdateOneWithoutScriptSentencesNestedInput
  }

  export type ScriptSentenceUncheckedUpdateWithoutSegmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    characterId?: NullableStringFieldUpdateOperationsInput | string | null
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    audioFiles?: AudioFileUncheckedUpdateManyWithoutScriptSentenceNestedInput
  }

  export type ScriptSentenceUncheckedUpdateManyWithoutSegmentInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    characterId?: NullableStringFieldUpdateOperationsInput | string | null
    rawSpeaker?: NullableStringFieldUpdateOperationsInput | string | null
    text?: StringFieldUpdateOperationsInput | string
    orderInSegment?: IntFieldUpdateOperationsInput | number
    tone?: NullableStringFieldUpdateOperationsInput | string | null
    strength?: NullableIntFieldUpdateOperationsInput | number | null
    pauseAfter?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    ttsParameters?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileCreateManyScriptSentenceInput = {
    id?: string
    bookId: string
    segmentId?: string | null
    filePath: string
    fileName?: string | null
    duration?: Decimal | DecimalJsLike | number | string | null
    fileSize?: bigint | number | null
    format?: string | null
    status?: string
    errorMessage?: string | null
    retryCount?: number
    provider?: string | null
    voiceProfileId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AudioFileUpdateWithoutScriptSentenceInput = {
    id?: StringFieldUpdateOperationsInput | string
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    book?: BookUpdateOneRequiredWithoutAudioFilesNestedInput
    segment?: TextSegmentUpdateOneWithoutAudioFilesNestedInput
    voiceProfile?: TTSVoiceProfileUpdateOneWithoutAudioFilesNestedInput
  }

  export type AudioFileUncheckedUpdateWithoutScriptSentenceInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AudioFileUncheckedUpdateManyWithoutScriptSentenceInput = {
    id?: StringFieldUpdateOperationsInput | string
    bookId?: StringFieldUpdateOperationsInput | string
    segmentId?: NullableStringFieldUpdateOperationsInput | string | null
    filePath?: StringFieldUpdateOperationsInput | string
    fileName?: NullableStringFieldUpdateOperationsInput | string | null
    duration?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    fileSize?: NullableBigIntFieldUpdateOperationsInput | bigint | number | null
    format?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    errorMessage?: NullableStringFieldUpdateOperationsInput | string | null
    retryCount?: IntFieldUpdateOperationsInput | number
    provider?: NullableStringFieldUpdateOperationsInput | string | null
    voiceProfileId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}